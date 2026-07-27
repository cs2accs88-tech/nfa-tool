const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/connection');
const { buildAccountPayload } = require('../models/accountModel');
const { isValidSteamId64, isValidIsoDate } = require('../utils/validator');
const { parseImportFile } = require('./parser');
const { generateProfileURL } = require('../steam/steamLinkGenerator');
const { validateProfileURL } = require('../steam/steamLinkValidator');
const { VALIDATION_STATUS } = require('../steam/steamConstants');

const IMPORT_HISTORY_TABLE = 'import_history';

function createHistoryTable() {
  const db = getDatabase();
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

function normalizeTagString(tags) {
  if (!tags) return null;
  if (Array.isArray(tags)) return tags.join(', ');
  return String(tags).trim();
}

function buildImportRecord(record, index) {
  const item = {
    steamId64: record.steamId64,
    username: record.username,
    displayName: record.displayName,
    profileUrl: record.profileUrl,
    notes: record.notes,
    tags: normalizeTagString(record.tags),
    primeStatus: record.primeStatus != null ? Number(record.primeStatus) : 0,
    vacStatus: record.vacStatus != null ? Number(record.vacStatus) : 0,
    gameBanStatus: record.gameBanStatus != null ? Number(record.gameBanStatus) : 0,
    cooldownStatus: record.cooldownStatus != null ? Number(record.cooldownStatus) : 0,
    accountStatus: record.accountStatus,
    rank: record.rank != null ? Number(record.rank) : null,
    level: record.level != null ? Number(record.level) : null,
    hoursPlayed: record.hoursPlayed != null ? Number(record.hoursPlayed) : null,
    rating: record.rating != null ? Number(record.rating) : null,
    inventoryValue: record.inventoryValue != null ? Number(record.inventoryValue) : 0,
    itemCount: record.itemCount != null ? Number(record.itemCount) : 0,
    rareItemCount: record.rareItemCount != null ? Number(record.rareItemCount) : 0,
    medalCount: record.medalCount != null ? Number(record.medalCount) : 0,
    medalsList: record.medalsList,
    lastCheckedAt: record.lastCheckedAt,
    sourceIndex: index
  };

  return item;
}

function validateImportRecord(record, index) {
  const errors = [];

  if (!record.steamId64) {
    errors.push('Missing steamId64');
  } else if (!isValidSteamId64(record.steamId64)) {
    errors.push('Invalid steamId64 format');
  }

  if (!record.username) {
    errors.push('Missing username');
  }

  if (record.lastCheckedAt && !isValidIsoDate(record.lastCheckedAt)) {
    errors.push('Invalid lastCheckedAt ISO date');
  }

  return {
    index,
    record,
    valid: errors.length === 0,
    errors
  };
}

function createImportSummary(fileName, fileType, records, results) {
  return {
    fileName,
    fileType,
    recordCount: records.length,
    importedCount: results.filter((item) => item.status === 'imported').length,
    duplicateCount: results.filter((item) => item.status === 'duplicate').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    errors: results
      .filter((item) => item.errors && item.errors.length)
      .map((item) => ({ index: item.index, errors: item.errors }))
  };
}

function saveImportHistory(db, summary) {
  const insert = db.prepare(`
    INSERT INTO ${IMPORT_HISTORY_TABLE} (fileName, fileType, recordCount, importedCount, duplicateCount, failedCount, errors, createdAt)
    VALUES (@fileName, @fileType, @recordCount, @importedCount, @duplicateCount, @failedCount, @errors, @createdAt)
  `);

  insert.run({
    fileName: summary.fileName,
    fileType: summary.fileType,
    recordCount: summary.recordCount,
    importedCount: summary.importedCount,
    duplicateCount: summary.duplicateCount,
    failedCount: summary.failedCount,
    errors: JSON.stringify(summary.errors),
    createdAt: new Date().toISOString()
  });
}

function loadExistingSteamIds(db) {
  const rows = db.prepare('SELECT steamId64 FROM accounts').all();
  return new Set(rows.map((row) => row.steamId64));
}

function importRecords(records) {
  const db = getDatabase();
  createHistoryTable();

  const existingSteamIds = loadExistingSteamIds(db);
  const insertAccount = db.prepare(`
    INSERT INTO accounts (
      steamId64, username, displayName, profileUrl, notes, tags,
      primeStatus, vacStatus, gameBanStatus, cooldownStatus, accountStatus,
      rank, level, hoursPlayed, rating, inventoryValue,
      itemCount, rareItemCount, medalCount, medalsList,
      createdAt, updatedAt, lastCheckedAt
    ) VALUES (
      @steamId64, @username, @displayName, @profileUrl, @notes, @tags,
      @primeStatus, @vacStatus, @gameBanStatus, @cooldownStatus, @accountStatus,
      @rank, @level, @hoursPlayed, @rating, @inventoryValue,
      @itemCount, @rareItemCount, @medalCount, @medalsList,
      @createdAt, @updatedAt, @lastCheckedAt
    )
  `);

  const transaction = db.transaction((items) => {
    const results = [];

    items.forEach((item) => {
      const status = existingSteamIds.has(item.steamId64) ? 'duplicate' : 'imported';
      const itemErrors = [];

      if (status === 'duplicate') {
        results.push({ index: item.sourceIndex, status, steamId64: item.steamId64, errors: [] });
        return;
      }

      try {
        const now = new Date().toISOString();
        const payload = buildAccountPayload({
          ...item,
          createdAt: now,
          updatedAt: now
        });

        insertAccount.run(payload);
        existingSteamIds.add(item.steamId64);
        results.push({ index: item.sourceIndex, status, steamId64: item.steamId64, errors: [] });
      } catch (error) {
        results.push({ index: item.sourceIndex, status: 'failed', steamId64: item.steamId64, errors: [error.message] });
      }
    });

    return results;
  });

  return transaction(records);
}

/**
 * Generates Steam profile URLs for newly imported accounts.
 * Validates imported profileUrl if present, otherwise generates from steamId64.
 * Never stops import due to a single invalid profile.
 * @param {Array} importResults - Results from importRecords.
 */
function generateProfileLinksForImported(importResults) {
  const db = getDatabase();
  const updateStmt = db.prepare(`
    UPDATE accounts SET
      steamProfileURL = ?,
      customProfileURL = ?,
      profileValidationStatus = ?,
      profileLastChecked = ?
    WHERE steamId64 = ?
  `);

  const now = new Date().toISOString();

  for (const result of importResults) {
    if (result.status !== 'imported' || !result.steamId64) continue;

    try {
      // Generate profile URL from SteamID64
      const genResult = generateProfileURL(result.steamId64);
      if (genResult.success) {
        updateStmt.run(genResult.url, null, VALIDATION_STATUS.VALID, now, result.steamId64);
      }
    } catch {
      // Never stop import for a profile link generation failure
    }
  }
}

function processImportFile(filePath, fileContent) {
  if (!filePath || !fileContent) {
    throw new Error('Both filePath and fileContent are required for import');
  }

  const rawRecords = parseImportFile(filePath, fileContent);
  const records = rawRecords.map(buildImportRecord);
  const validated = records.map((record, index) => validateImportRecord(record, index + 1));

  const summary = createImportSummary(path.basename(filePath), path.extname(filePath).replace('.', ''), records, validated);
  const importData = validated.filter((item) => item.valid).map((item) => item.record);

  const results = importRecords(importData);
  const combinedResults = validated.map((item) => {
    const result = results.find((row) => row.index === item.index);
    return {
      ...item,
      status: result ? result.status : 'failed',
      errors: result ? result.errors : item.errors
    };
  });

  const finalSummary = createImportSummary(path.basename(filePath), path.extname(filePath).replace('.', ''), records, combinedResults);
  saveImportHistory(getDatabase(), finalSummary);

  // Generate Steam profile URLs for newly imported accounts
  generateProfileLinksForImported(results);

  return {
    summary: finalSummary,
    results: combinedResults
  };
}

function getImportHistory(limit = 50) {
  const db = getDatabase();
  createHistoryTable();

  return db
    .prepare(`SELECT id, fileName, fileType, recordCount, importedCount, duplicateCount, failedCount, errors, createdAt FROM ${IMPORT_HISTORY_TABLE} ORDER BY createdAt DESC LIMIT ?`)
    .all(limit)
    .map((row) => ({
      ...row,
      errors: row.errors ? JSON.parse(row.errors) : []
    }));
}

module.exports = {
  processImportFile,
  getImportHistory
};
