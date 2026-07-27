const fs = require('fs/promises');

const SEPARATORS = [',', '\t', '|', ';'];

function detectSeparator(line) {
  const detection = SEPARATORS.map((separator) => ({
    separator,
    count: line.split(separator).length - 1
  }));

  const best = detection.reduce((prev, current) => (current.count > prev.count ? current : prev), { separator: null, count: -1 });
  return best.count > 0 ? best.separator : null;
}

function parseCsvLine(line, separator) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === separator && !insideQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsvContent(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('CSV content is empty.');
  }

  const separator = detectSeparator(lines[0]);
  if (!separator) {
    throw new Error('Unable to detect a supported CSV separator. Use comma, tab, pipe, or semicolon.');
  }

  const headers = parseCsvLine(lines[0], separator).map((header) => header.trim());
  const records = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex], separator);
    const record = {};

    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = values[index] !== undefined && values[index] !== '' ? values[index] : null;
    }

    records.push(record);
  }

  return records;
}

async function parseCsvFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return parseCsvContent(raw);
}

module.exports = {
  parseCsvFile,
  parseCsvContent
};
