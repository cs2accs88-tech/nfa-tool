const { initDatabase, getDatabase, closeDatabase } = require('./connection');
const { createSchema } = require('./schema');
const { runMigration, isMigrationApplied, populateExistingAccounts } = require('./migrations/profileLinkMigration');
const tokenMigration = require('./migrations/tokenMigration');
const updateSyncMigration = require('./migrations/updateSyncMigration');

function initializeDatabase() {
  const db = initDatabase();
  createSchema();
  runProfileLinkMigration();
  runTokenMigration();
  runUpdateSyncMigration();
  return db;
}

/**
 * Runs the update-sync migration (adds update tracking columns + update_history).
 */
function runUpdateSyncMigration() {
  if (!updateSyncMigration.isMigrationApplied()) {
    updateSyncMigration.runMigration();
  }
}

/**
 * Runs the token migration (adds loginToken + earnedServiceMedal columns) if needed.
 */
function runTokenMigration() {
  if (!tokenMigration.isMigrationApplied()) {
    tokenMigration.runMigration();
  }
}

/**
 * Runs the profile link migration if not already applied.
 * Adds profile URL columns to accounts and creates history table.
 */
function runProfileLinkMigration() {
  if (!isMigrationApplied()) {
    const result = runMigration();
    if (result.success) {
      // Auto-generate profile URLs for existing accounts
      populateExistingAccounts();
    }
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};
