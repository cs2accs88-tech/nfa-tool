const fs = require('fs/promises');
const path = require('path');

const reportDirectory = __dirname;

async function ensureReportDirectory() {
  await fs.mkdir(reportDirectory, { recursive: true });
}

function formatReportText(report) {
  return [
    'Import Report',
    '-------------',
    `File: ${report.fileName}`,
    `File type: ${report.fileType}`,
    `Import date: ${report.importDate}`,
    '',
    `Total records: ${report.totalRecords}`,
    `Imported: ${report.imported}`,
    `Updated: ${report.updated}`,
    `Failed: ${report.failed}`,
    `Duplicates: ${report.duplicates}`,
    '',
    'Errors:',
    report.errors.length > 0 ? report.errors.map((error) => `- [${error.index}] ${error.steamId64 || 'unknown'}: ${error.message}`).join('\n') : 'None',
    '',
    'Details:',
    report.details.map((detail) => `- [${detail.index}] ${detail.steamId64 || 'unknown'}: ${detail.status}${detail.message ? ` - ${detail.message}` : ''}`).join('\n')
  ].join('\n');
}

async function saveImportReport(report) {
  await ensureReportDirectory();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileNameBase = `import-report-${timestamp}`;
  const jsonPath = path.join(reportDirectory, `${fileNameBase}.json`);
  const textPath = path.join(reportDirectory, `${fileNameBase}.txt`);

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(textPath, formatReportText(report), 'utf8');

  return {
    jsonPath,
    textPath
  };
}

module.exports = {
  saveImportReport,
  formatReportText
};
