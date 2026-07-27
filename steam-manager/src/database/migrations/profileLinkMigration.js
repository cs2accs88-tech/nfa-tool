/**
 * @module profileLinkMigration
 * @description Database migration to add Steam profile link fields to the accounts table
 * and create the profile_link_history table.
 * Preserves existing data and supports safe rollback.
 *
 * @dependencies ../connection
 *
 * @example
 * const { runMigration, rollbackMigration } = require('./profileLinkMigration');
 * runMigration(); // Adds columns and creates history table
 */

const { getDatabase } = require('../connection');

const MIGRATION_NAME = 'profile_link_migration';
const MIGRATION_VERSION = 1;

/**
 * Checks if a column exists in a table.
 * @param {Object} db - Database instance.
 * @param {string} table - Table name.
 * @param {string} column - Column name.
 * @returns {boolean}
 */
function columnExists(db, table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some((col) => col.name === column);
}

/**
 * Checks if a table exists in the database.
 * @param {Object} db - Database instance.
 * @param {string} table - Table name.
 * @returns {boolean}
 */
function tableExists(db, table) {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table);
  return !!row;
}

/**
 * Runs the profile link migration.
 * Adds columns to accounts table and creates profile_link_history table.
 * Idempotent - safe to run multiple times.
 * @returns {{ success: boolean, changes: string[], error?: string }}
 */
function runMigration() {
  const db = getDatabase();
  const changes = [];

  try {
    db.transaction(() => {
      // Add steamProfileURL column
      if (!columnExists(db, 'accounts', 'steamProfileURL')) {
        db.prepare('ALTER TABLE accounts ADD COLUMN steamProfileURL TEXT').run();
        changes.push('Added steamProfileURL column to accounts');
      }

      // Add customProfileURL column
      if (!columnExists(db, 'accounts', 'customProfileURL')) {
        db.prepare('ALTER TABLE accounts ADD COLUMN customProfileURL TEXT').run();
        changes.push('Added customProfileURL column to accounts');
      }

      // Add profileLastChecked column
      if (!columnExists(db, 'accounts', 'profileLastChecked')) {
        db.prepare('ALTER TABLE accounts ADD COLUMN profileLastChecked TEXT').run();
        changes.push('Added profileLastChecked column to accounts');
      }

      // Add profileValidationStatus column
      if (!columnExists(db, 'accounts', 'profileValidationStatus')) {
        db.prepare('ALTER TABLE accounts ADD COLUMN profileValidationStatus TEXT').run();
        changes.push('Added profileValidationStatus column to accounts');
      }

      // Create index on steamProfileURL
      db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_accounts_steamProfileURL ON accounts(steamProfileURL)'
      ).run();

      // Create index on customProfileURL
      db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_accounts_customProfileURL ON accounts(customProfileURL)'
      ).run();

      // Create profile_link_history table
      if (!tableExists(db, 'profile_link_history')) {
        db.prepare(`
          CREATE TABLE profile_link_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            accountId INTEGER NOT NULL,
            oldURL TEXT,
            newURL TEXT,
            action TEXT NOT NULL,
            changedBy TEXT DEFAULT 'system',
            createdAt TEXT NOT NULL,
            FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `).run();
        changes.push('Created profile_link_history table');

        db.prepare(
          'CREATE INDEX IF NOT EXISTS idx_profile_link_history_accountId ON profile_link_history(accountId)'
        ).run();

        db.prepare(
          'CREATE INDEX IF NOT EXISTS idx_profile_link_history_createdAt ON profile_link_history(createdAt)'
        ).run();

        changes.push('Created indexes on profile_link_history');
      }

      // Record migration in migrations tracking table
      if (!tableExists(db, 'migrations')) {
        db.prepare(`
          CREATE TABLE migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            version INTEGER NOT NULL,
            appliedAt TEXT NOT NULL
          )
        `).run();
      }

      const existing = db.prepare('SELECT id FROM migrations WHERE name = ?').get(MIGRATION_NAME);
      if (!existing) {
        db.prepare('INSERT INTO migrations (name, version, appliedAt) VALUES (?, ?, ?)').run(
          MIGRATION_NAME,
          MIGRATION_VERSION,
          new Date().toISOString()
        );
      }
    })();

    return { success: true, changes };
  } catch (error) {
    return { success: false, changes, error: error.message };
  }
}

/**
 * Rolls back the profile link migration.
 * Note: SQLite does not support DROP COLUMN before version 3.35.0.
 * This rollback drops the history table and removes the migration record.
 * Account columns are left in place to preserve data safety.
 * @returns {{ success: boolean, changes: string[], error?: string }}
 */
function rollbackMigration() {
  const db = getDatabase();
  const changes = [];

  try {
    db.transaction(() => {
      // Drop history table
      if (tableExists(db, 'profile_link_history')) {
        db.prepare('DROP TABLE profile_link_history').run();
        changes.push('Dropped profile_link_history table');
      }

      // Remove indexes (columns are preserved for data safety)
      db.prepare('DROP INDEX IF EXISTS idx_accounts_steamProfileURL').run();
      db.prepare('DROP INDEX IF EXISTS idx_accounts_customProfileURL').run();
      changes.push('Dropped profile link indexes');

      // Remove migration record
      if (tableExists(db, 'migrations')) {
        db.prepare('DELETE FROM migrations WHERE name = ?').run(MIGRATION_NAME);
        changes.push('Removed migration record');
      }
    })();

    return { success: true, changes };
  } catch (error) {
    return { success: false, changes, error: error.message };
  }
}

/**
 * Checks if the migration has already been applied.
 * @returns {boolean}
 */
function isMigrationApplied() {
  const db = getDatabase();
  try {
    if (!tableExists(db, 'migrations')) return false;
    const row = db.prepare('SELECT id FROM migrations WHERE name = ?').get(MIGRATION_NAME);
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Populates steamProfileURL for existing accounts that have a steamId64 but no profile URL.
 * @returns {{ success: boolean, updatedCount: number, error?: string }}
 */
function populateExistingAccounts() {
  const db = getDatabase();

  try {
    const accounts = db.prepare(
      'SELECT id, steamId64 FROM accounts WHERE steamProfileURL IS NULL AND steamId64 IS NOT NULL'
    ).all();

    if (accounts.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const updateStmt = db.prepare(
      'UPDATE accounts SET steamProfileURL = ?, profileValidationStatus = ?, profileLastChecked = ? WHERE id = ?'
    );

    const now = new Date().toISOString();
    let updatedCount = 0;

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const url = `https://steamcommunity.com/profiles/${row.steamId64}`;
        updateStmt.run(url, 'valid', now, row.id);
        updatedCount += 1;
      }
    });

    transaction(accounts);

    return { success: true, updatedCount };
  } catch (error) {
    return { success: false, updatedCount: 0, error: error.message };
  }
}

module.exports = {
  runMigration,
  rollbackMigration,
  isMigrationApplied,
  populateExistingAccounts
};
