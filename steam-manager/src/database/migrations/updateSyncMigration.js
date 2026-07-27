/**
 * @module updateSyncMigration
 * @description Adds account update-tracking + public-profile columns and the
 * update_history table used by the automatic account data updater.
 *
 * New account columns:
 *  - lastUpdated           TEXT
 *  - updateStatus          TEXT   (idle | success | failed | private)
 *  - updateError           TEXT
 *  - lastSuccessfulUpdate  TEXT
 *  - avatarUrl             TEXT
 *  - profileVisibility     TEXT   (public | private | friends | unknown)
 *  - communityBanned       INTEGER NOT NULL DEFAULT 0
 *  - economyBan            TEXT
 *  - personaName           TEXT
 *
 * Idempotent + records itself in the migrations table.
 *
 * @dependencies ../connection
 */

const { getDatabase } = require('../connection');

const MIGRATION_NAME = 'update_sync_migration';
const MIGRATION_VERSION = 1;

const NEW_COLUMNS = [
  ['lastUpdated', 'TEXT'],
  ['updateStatus', 'TEXT'],
  ['updateError', 'TEXT'],
  ['lastSuccessfulUpdate', 'TEXT'],
  ['avatarUrl', 'TEXT'],
  ['profileVisibility', 'TEXT'],
  ['communityBanned', 'INTEGER NOT NULL DEFAULT 0'],
  ['economyBan', 'TEXT'],
  ['personaName', 'TEXT']
];

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function tableExists(db, table) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
}

/**
 * Runs the update-sync migration.
 * @returns {{ success: boolean, changes: string[], error?: string }}
 */
function runMigration() {
  const db = getDatabase();
  const changes = [];

  try {
    db.transaction(() => {
      for (const [name, type] of NEW_COLUMNS) {
        if (!columnExists(db, 'accounts', name)) {
          db.prepare(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`).run();
          changes.push(`Added ${name} column`);
        }
      }

      if (!tableExists(db, 'update_history')) {
        db.prepare(`
          CREATE TABLE update_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            accountId INTEGER,
            steamId64 TEXT,
            updateType TEXT NOT NULL,
            result TEXT NOT NULL,
            error TEXT,
            createdAt TEXT NOT NULL
          )
        `).run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_update_history_accountId ON update_history(accountId)').run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_update_history_createdAt ON update_history(createdAt)').run();
        changes.push('Created update_history table');
      }

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
      if (!db.prepare('SELECT id FROM migrations WHERE name = ?').get(MIGRATION_NAME)) {
        db.prepare('INSERT INTO migrations (name, version, appliedAt) VALUES (?, ?, ?)').run(
          MIGRATION_NAME, MIGRATION_VERSION, new Date().toISOString()
        );
      }
    })();

    return { success: true, changes };
  } catch (error) {
    return { success: false, changes, error: error.message };
  }
}

/**
 * @returns {boolean} whether the migration has been applied.
 */
function isMigrationApplied() {
  const db = getDatabase();
  try {
    if (!tableExists(db, 'migrations')) return false;
    return !!db.prepare('SELECT id FROM migrations WHERE name = ?').get(MIGRATION_NAME);
  } catch {
    return false;
  }
}

module.exports = { runMigration, isMigrationApplied };
