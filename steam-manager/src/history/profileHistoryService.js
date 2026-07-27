/**
 * @module profileHistoryService
 * @description Tracks and retrieves profile link change history.
 * Logs all profile link mutations (created, updated, validated, deleted).
 *
 * @dependencies ../database/connection, ../steam/steamConstants
 *
 * @example
 * const { logProfileChange, getProfileHistory } = require('./profileHistoryService');
 * logProfileChange({ accountId: 1, oldURL: null, newURL: 'https://...', action: 'created' });
 */

const { getDatabase } = require('../database/connection');
const { HISTORY_ACTIONS } = require('../steam/steamConstants');

const TABLE_NAME = 'profile_link_history';

/**
 * Ensures the profile_link_history table exists.
 * @param {Object} db - Database instance.
 */
function ensureTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
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
}

/**
 * Logs a profile link change to the history table.
 * @param {Object} params - The change parameters.
 * @param {number} params.accountId - The account ID.
 * @param {string|null} params.oldURL - The previous URL (null for creation).
 * @param {string|null} params.newURL - The new URL (null for deletion).
 * @param {string} params.action - The action type (created, updated, validated, deleted).
 * @param {string} [params.changedBy='system'] - Who performed the change.
 * @returns {{ success: boolean, id?: number, error?: string }}
 */
function logProfileChange({ accountId, oldURL = null, newURL = null, action, changedBy = 'system' }) {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    if (!action || !Object.values(HISTORY_ACTIONS).includes(action)) {
      return { success: false, error: `Invalid action type. Must be one of: ${Object.values(HISTORY_ACTIONS).join(', ')}` };
    }

    const db = getDatabase();
    ensureTable(db);

    const stmt = db.prepare(`
      INSERT INTO ${TABLE_NAME} (accountId, oldURL, newURL, action, changedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      accountId,
      oldURL || null,
      newURL || null,
      action,
      changedBy || 'system',
      new Date().toISOString()
    );

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return { success: false, error: `Failed to log profile change: ${error.message}` };
  }
}

/**
 * Retrieves the profile link history for a specific account.
 * @param {number} accountId - The account ID.
 * @param {Object} [options] - Query options.
 * @param {number} [options.limit=50] - Maximum records to return.
 * @param {number} [options.offset=0] - Offset for pagination.
 * @returns {{ success: boolean, history?: Array, error?: string }}
 */
function getProfileHistory(accountId, { limit = 50, offset = 0 } = {}) {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    const db = getDatabase();
    ensureTable(db);

    const rows = db.prepare(`
      SELECT * FROM ${TABLE_NAME}
      WHERE accountId = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(accountId, limit, offset);

    return { success: true, history: rows };
  } catch (error) {
    return { success: false, error: `Failed to get profile history: ${error.message}` };
  }
}

/**
 * Retrieves the full profile link history across all accounts.
 * @param {Object} [options] - Query options.
 * @param {number} [options.limit=100] - Maximum records to return.
 * @param {number} [options.offset=0] - Offset for pagination.
 * @returns {{ success: boolean, history?: Array, error?: string }}
 */
function getAllProfileHistory({ limit = 100, offset = 0 } = {}) {
  try {
    const db = getDatabase();
    ensureTable(db);

    const rows = db.prepare(`
      SELECT h.*, a.steamId64, a.username
      FROM ${TABLE_NAME} h
      LEFT JOIN accounts a ON h.accountId = a.id
      ORDER BY h.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return { success: true, history: rows };
  } catch (error) {
    return { success: false, error: `Failed to get all profile history: ${error.message}` };
  }
}

/**
 * Gets the count of history entries for a specific account.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, count?: number, error?: string }}
 */
function getHistoryCount(accountId) {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    const db = getDatabase();
    ensureTable(db);

    const row = db.prepare(`SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE accountId = ?`).get(accountId);
    return { success: true, count: row.count };
  } catch (error) {
    return { success: false, error: `Failed to get history count: ${error.message}` };
  }
}

/**
 * Logs a profile creation event.
 * @param {number} accountId - The account ID.
 * @param {string} url - The new profile URL.
 * @param {string} [changedBy='system'] - Who performed the change.
 * @returns {{ success: boolean, id?: number, error?: string }}
 */
function logProfileCreated(accountId, url, changedBy = 'system') {
  return logProfileChange({
    accountId,
    oldURL: null,
    newURL: url,
    action: HISTORY_ACTIONS.CREATED,
    changedBy
  });
}

/**
 * Logs a profile update event.
 * @param {number} accountId - The account ID.
 * @param {string} oldURL - The previous URL.
 * @param {string} newURL - The new URL.
 * @param {string} [changedBy='system'] - Who performed the change.
 * @returns {{ success: boolean, id?: number, error?: string }}
 */
function logProfileUpdated(accountId, oldURL, newURL, changedBy = 'system') {
  return logProfileChange({
    accountId,
    oldURL,
    newURL,
    action: HISTORY_ACTIONS.UPDATED,
    changedBy
  });
}

/**
 * Logs a profile validation event.
 * @param {number} accountId - The account ID.
 * @param {string} url - The validated URL.
 * @param {string} [changedBy='system'] - Who performed the validation.
 * @returns {{ success: boolean, id?: number, error?: string }}
 */
function logProfileValidated(accountId, url, changedBy = 'system') {
  return logProfileChange({
    accountId,
    oldURL: url,
    newURL: url,
    action: HISTORY_ACTIONS.VALIDATED,
    changedBy
  });
}

/**
 * Logs a profile deletion event.
 * @param {number} accountId - The account ID.
 * @param {string} oldURL - The deleted URL.
 * @param {string} [changedBy='system'] - Who performed the deletion.
 * @returns {{ success: boolean, id?: number, error?: string }}
 */
function logProfileDeleted(accountId, oldURL, changedBy = 'system') {
  return logProfileChange({
    accountId,
    oldURL,
    newURL: null,
    action: HISTORY_ACTIONS.DELETED,
    changedBy
  });
}

module.exports = {
  logProfileChange,
  getProfileHistory,
  getAllProfileHistory,
  getHistoryCount,
  logProfileCreated,
  logProfileUpdated,
  logProfileValidated,
  logProfileDeleted
};
