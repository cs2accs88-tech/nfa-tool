const path = require('path');
const { parseJsonFile } = require('./jsonImporter');
const { parseCsvFile } = require('./csvImporter');
const { parseTxtFile } = require('./txtImporter');
const { validateImportRecord } = require('./importValidator');
const { saveImportReport } = require('../reports/importReports');
const { addAccount, getAccountBySteamId, updateAccount } = require('../services/accountService');

const SUPPORTED_FILE_TYPES = ['.json', '.csv', '.txt'];
const DUPLICATE_STRATEGIES = ['skip', 'add', 'update', 'replace'];

function detectFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_FILE_TYPES.includes(extension)) {
    throw new Error(`Unsupported import file type: ${extension}`);
  }
  return extension;
}

async function parseFile(filePath) {
  const extension = detectFileType(filePath);

  switch (extension) {
    case '.json':
      return parseJsonFile(filePath);
    case '.csv':
      return parseCsvFile(filePath);
    case '.txt':
      return parseTxtFile(filePath);
    default:
      throw new Error(`No parser available for file type: ${extension}`);
  }
}

function validateImport(rawRecords) {
  return rawRecords.map((record, index) => validateImportRecord(record, index + 1));
}

function checkDuplicates(validatedRecords) {
  return validatedRecords
    .filter((record) => record.valid)
    .map((record) => ({
      index: record.index,
      steamId64: record.account.steamId64,
      exists: getAccountBySteamId(record.account.steamId64).success && Boolean(getAccountBySteamId(record.account.steamId64).account)
    }));
}

function resolveDuplicateStrategy(strategy) {
  const normalized = String(strategy || 'skip').toLowerCase();
  return DUPLICATE_STRATEGIES.includes(normalized) ? normalized : 'skip';
}

function createImportReport(filePath) {
  return {
    fileName: path.basename(filePath),
    fileType: path.extname(filePath).toLowerCase(),
    importDate: new Date().toISOString(),
    totalRecords: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    duplicates: 0,
    errors: [],
    details: []
  };
}

async function saveImportedAccounts(records, duplicateStrategy) {
  const report = {
    imported: 0,
    updated: 0,
    failed: 0,
    duplicates: 0,
    errors: [],
    details: []
  };

  for (const record of records) {
    if (!record.valid) {
      report.failed += 1;
      report.errors.push({ index: record.index, steamId64: record.account.steamId64, message: record.errors.join('; ') });
      report.details.push({ index: record.index, steamId64: record.account.steamId64, status: 'failed', message: record.errors.join('; ') });
      continue;
    }

    const steamId = record.account.steamId64;
    const existing = getAccountBySteamId(steamId);
    const hasExisting = existing.success && Boolean(existing.account);
    const strategy = resolveDuplicateStrategy(duplicateStrategy);

    if (hasExisting) {
      if (strategy === 'skip') {
        report.duplicates += 1;
        report.details.push({ index: record.index, steamId64: steamId, status: 'duplicate skipped' });
        continue;
      }

      if (strategy === 'update' || strategy === 'replace') {
        const updateResult = updateAccount({ ...record.account, id: existing.account.id });
        if (updateResult.success) {
          report.updated += 1;
          report.details.push({ index: record.index, steamId64: steamId, status: 'updated' });
        } else {
          report.failed += 1;
          report.errors.push({ index: record.index, steamId64: steamId, message: updateResult.error });
          report.details.push({ index: record.index, steamId64: steamId, status: 'failed', message: updateResult.error });
        }
        continue;
      }
    }

    const createResult = addAccount(record.account);
    if (createResult.success) {
      report.imported += 1;
      report.details.push({ index: record.index, steamId64: steamId, status: 'imported' });
    } else {
      if (createResult.error && createResult.error.includes('UNIQUE constraint failed')) {
        report.duplicates += 1;
        report.details.push({ index: record.index, steamId64: steamId, status: 'duplicate skipped' });
      } else {
        report.failed += 1;
        report.errors.push({ index: record.index, steamId64: steamId, message: createResult.error });
        report.details.push({ index: record.index, steamId64: steamId, status: 'failed', message: createResult.error });
      }
    }
  }

  return report;
}

async function generateReport(report) {
  return saveImportReport(report);
}

async function importFile(filePath, options = {}) {
  const report = createImportReport(filePath);
  const duplicateStrategy = resolveDuplicateStrategy(options.duplicateStrategy);

  let rawRecords;
  try {
    rawRecords = await parseFile(filePath);
  } catch (error) {
    report.failed = 1;
    report.errors.push({ index: 0, steamId64: null, message: error.message });
    report.details.push({ index: 0, steamId64: null, status: 'failed', message: error.message });
    await generateReport(report);
    return report;
  }

  report.totalRecords = rawRecords.length;

  const validatedRecords = validateImport(rawRecords);
  const saveReport = await saveImportedAccounts(validatedRecords, duplicateStrategy);

  report.imported = saveReport.imported;
  report.updated = saveReport.updated;
  report.failed = saveReport.failed;
  report.duplicates = saveReport.duplicates;
  report.errors = saveReport.errors;
  report.details = saveReport.details;

  await generateReport(report);
  return report;
}

module.exports = {
  detectFileType,
  parseFile,
  validateImport,
  checkDuplicates,
  saveImportedAccounts,
  generateReport,
  importFile
};
