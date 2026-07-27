/**
 * @module tokenMigration
 * @description Adds login-token related columns to the accounts table:
 *  - loginToken        TEXT     (Steam JWT refresh/login token)
 *  - earnedServiceMedal INTEGER (0/1)
 * Idempotent and safe to run repeatedly. Preserves existing data.
 *
 * @dependencies ../connection
 */

const { getDatabase } = require('../connection');

const MIGRATION_NAME = 'token_import_migration';
const MIGRATION_VERSION = 1;

/**
 * Checks if a column exists on a table.
 * @param {object} db
 * @param {string} table
 * @param {string} column
 * @returns {boolean}
 */
function columnExists(db, table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some((c) => c.name === column);
}

/**
 * Checks if a table exists.
 * @param {object} db
 * @param {string} table
 * @returns {boolean}
 */
function tableExists(db, table) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
}

/**
 * Runs the token migration. Adds columns and records the migration.
 * @returns {{ success: boolean, changes: string[], error?: string }}
 */
function runMigration() {
  const db = getDatabase();
  const changes = [];

  try {
    db.transaction(() => {
      if (!columnExists(db, 'accounts', 'loginToken')) {
        db.prepare('ALTER TABLE accounts ADD COLUMN loginToken TEXT').run();
        changes.push('Added loginToken column');
      }
      if (!columnExists(db, 'accounts', 'earnedServiceMedal')) {
        db.prepare('ALTER TABLE accounts ADD COLUMN earnedServiceMedal INTEGER NOT NULL DEFAULT 0').run();
        changes.push('Added earnedServiceMedal column');
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
 * Checks whether the migration has already been applied.
 * @returns {boolean}
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

module.exports = {
  runMigration,
  isMigrationApplied,
  columnExists
};
