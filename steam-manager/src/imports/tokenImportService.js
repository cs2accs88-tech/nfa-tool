/**
 * @module tokenImportService
 * @description Imports Steam account tokens (----delimited format) into the database.
 * - Validates each line
 * - Upserts by SteamID64 (updates token + stats if the account already exists)
 * - Auto-generates the Steam profile URL
 * - Records an import_history entry
 *
 * Security note: login tokens are stored locally in the app's SQLite database only.
 * Token values are never written to logs.
 *
 * @dependencies ../database/connection, ./tokenParser, ../steam/steamLinkGenerator, ../steam/steamConstants
 */

const { getDatabase } = require('../database/connection');
const { parseTokenText } = require('./tokenParser');
const { generateProfileURL } = require('../steam/steamLinkGenerator');
const { VALIDATION_STATUS } = require('../steam/steamConstants');

const IMPORT_HISTORY_TABLE = 'import_history';

/**
 * Ensures the import_history table exists.
 * @param {object} db
 */
function ensureHistoryTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${IMPORT_HISTORY_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      fileType TEXT NOT NULL,
      recordCount INTEGER NOT NULL,
      importedCount INTEGER NOT NULL,
      duplicateCount INTEGER NOT NULL,
      failedCount INTEGER NOT NULL,
      errors TEXT,
      createdAt TEXT NOT NULL
    )
  `).run();
}

/**
 * Imports token text into the database.
 * @param {string} text - Raw token lines (one account per line).
 * @param {object} [options]
 * @param {string} [options.sourceName='pasted tokens'] - Label for import history.
 * @returns {{ success: boolean, summary?: object, results?: object[], error?: string }}
 */
function importTokens(text, options = {}) {
  const sourceName = options.sourceName || 'pasted tokens';

  try {
    if (!text || String(text).trim().length === 0) {
      return { success: false, error: 'No token data provided' };
    }

    const db = getDatabase();
    ensureHistoryTable(db);

    const parsed = parseTokenText(text);
    if (parsed.length === 0) {
      return { success: false, error: 'No token lines found' };
    }

    const findStmt = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?');

    const insertStmt = db.prepare(`
      INSERT INTO accounts (
        steamId64, username, loginToken, primeStatus, vacStatus, cooldownStatus,
        earnedServiceMedal, rank, rating, inventoryValue, medalCount, rareItemCount,
        steamProfileURL, profileValidationStatus, profileLastChecked,
        createdAt, updatedAt, lastCheckedAt
      ) VALUES (
        @steamId64, @username, @loginToken, @primeStatus, @vacStatus, @cooldownStatus,
        @earnedServiceMedal, @rank, @rating, @inventoryValue, @medalCount, @rareItemCount,
        @steamProfileURL, @profileValidationStatus, @profileLastChecked,
        @createdAt, @updatedAt, @lastCheckedAt
      )
    `);

    const updateStmt = db.prepare(`
      UPDATE accounts SET
        loginToken = @loginToken,
        primeStatus = @primeStatus,
        vacStatus = @vacStatus,
        cooldownStatus = @cooldownStatus,
        earnedServiceMedal = @earnedServiceMedal,
        rank = @rank,
        rating = @rating,
        inventoryValue = @inventoryValue,
        medalCount = @medalCount,
        rareItemCount = @rareItemCount,
        steamProfileURL = @steamProfileURL,
        profileValidationStatus = @profileValidationStatus,
        profileLastChecked = @profileLastChecked,
        updatedAt = @updatedAt,
        lastCheckedAt = @lastCheckedAt
      WHERE steamId64 = @steamId64
    `);

    const results = [];

    const runAll = db.transaction((items) => {
      for (const item of items) {
        if (!item.valid) {
          results.push({ index: item.index, status: 'failed', errors: item.errors });
          continue;
        }

        const r = item.record;
        const now = new Date().toISOString();
        const urlResult = generateProfileURL(r.steamId64);
        const profileUrl = urlResult.success ? urlResult.url : null;

        const params = {
          steamId64: r.steamId64,
          username: r.username,
          loginToken: r.loginToken,
          primeStatus: r.primeStatus ? 1 : 0,
          vacStatus: r.vacStatus ? 1 : 0,
          cooldownStatus: r.cooldownStatus ? 1 : 0,
          earnedServiceMedal: r.earnedServiceMedal ? 1 : 0,
          rank: r.rank === null || r.rank === undefined ? null : r.rank,
          rating: r.rating || 0,
          inventoryValue: r.inventoryValue || 0,
          medalCount: r.medalCount || 0,
          rareItemCount: r.rareItemCount || 0,
          steamProfileURL: profileUrl,
          profileValidationStatus: profileUrl ? VALIDATION_STATUS.VALID : null,
          profileLastChecked: profileUrl ? now : null,
          createdAt: now,
          updatedAt: now,
          lastCheckedAt: r.lastCheckedAt || null
        };

        try {
          const existing = findStmt.get(r.steamId64);
          if (existing) {
            updateStmt.run(params);
            results.push({ index: item.index, status: 'updated', steamId64: r.steamId64, errors: [] });
          } else {
            insertStmt.run(params);
            results.push({ index: item.index, status: 'imported', steamId64: r.steamId64, errors: [] });
          }
        } catch (error) {
          results.push({ index: item.index, status: 'failed', steamId64: r.steamId64, errors: [error.message] });
        }
      }
    });

    runAll(parsed);

    const summary = {
      sourceName,
      recordCount: parsed.length,
      importedCount: results.filter((x) => x.status === 'imported').length,
      updatedCount: results.filter((x) => x.status === 'updated').length,
      duplicateCount: 0,
      failedCount: results.filter((x) => x.status === 'failed').length,
      errors: results.filter((x) => x.errors && x.errors.length).map((x) => ({ index: x.index, errors: x.errors }))
    };

    // Record history (no token values are stored here)
    db.prepare(`
      INSERT INTO ${IMPORT_HISTORY_TABLE}
        (fileName, fileType, recordCount, importedCount, duplicateCount, failedCount, errors, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sourceName,
      'token',
      summary.recordCount,
      summary.importedCount + summary.updatedCount,
      0,
      summary.failedCount,
      JSON.stringify(summary.errors),
      new Date().toISOString()
    );

    return { success: true, summary, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  importTokens
};
