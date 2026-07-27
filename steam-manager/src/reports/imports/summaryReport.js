function buildImportReport(summary) {
  return {
    fileName: summary.fileName,
    fileType: summary.fileType,
    recordCount: summary.recordCount,
    importedCount: summary.importedCount,
    duplicateCount: summary.duplicateCount,
    failedCount: summary.failedCount,
    createdAt: summary.createdAt,
    errors: summary.errors
  };
}

function formatReport(summary) {
  return `Import report for ${summary.fileName} (${summary.fileType})\n` +
    `Records: ${summary.recordCount}\n` +
    `Imported: ${summary.importedCount}\n` +
    `Duplicates: ${summary.duplicateCount}\n` +
    `Failed: ${summary.failedCount}\n` +
    `Timestamp: ${summary.createdAt}\n` +
    (summary.errors.length ? `Errors:\n${summary.errors.map((err) => `  Row ${err.index}: ${err.errors.join('; ')}`).join('\n')}` : 'No import errors.');
}

module.exports = {
  buildImportReport,
  formatReport
};
