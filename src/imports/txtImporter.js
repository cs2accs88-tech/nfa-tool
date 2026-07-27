const fs = require('fs/promises');
const { parseCsvContent } = require('./csvImporter');

function hasTableSeparator(line) {
  return [',', '\t', '|', ';'].some((separator) => line.includes(separator));
}

function splitKeyValue(line) {
  const separatorMatch = line.match(/[:=]/);
  if (!separatorMatch) {
    return [null, null];
  }

  const separatorIndex = separatorMatch.index;
  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();

  return [key, value];
}

async function parseTxtFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return [];
  }

  if (hasTableSeparator(nonEmptyLines[0]) && nonEmptyLines.length > 1) {
    return parseCsvContent(nonEmptyLines.join('\n'));
  }

  const records = [];
  let currentRecord = {};

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (Object.keys(currentRecord).length > 0) {
        records.push(currentRecord);
        currentRecord = {};
      }
      continue;
    }

    const [key, value] = splitKeyValue(line);
    if (key && value !== null) {
      currentRecord[key.trim()] = value.trim();
    }
  }

  if (Object.keys(currentRecord).length > 0) {
    records.push(currentRecord);
  }

  return records;
}

module.exports = {
  parseTxtFile
};
