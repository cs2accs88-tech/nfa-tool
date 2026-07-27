const fs = require('fs');
const path = require('path');
const { processImportFile, getImportHistory } = require('../imports/importService');

function importAccountFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return processImportFile(filePath, content);
}

function importHistory(limit) {
  return getImportHistory(limit);
}

module.exports = {
  importAccountFile,
  importHistory
};
