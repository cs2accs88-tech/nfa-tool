const path = require('path');

function normalizeString(value) {
  if (value == null) return null;
  return String(value).trim();
}

function parseJsonFile(content) {
  let payload;
  try {
    payload = JSON.parse(content);
  } catch (error) {
    throw new Error('Invalid JSON file format');
  }

  if (!Array.isArray(payload)) {
    throw new Error('JSON import requires a top-level array of account objects');
  }

  return payload.map((item) => ({
    steamId64: normalizeString(item.steamId64 || item.steamID || item.steam_id || item.id),
    username: normalizeString(item.username || item.userName || item.name),
    displayName: normalizeString(item.displayName || item.display_name || item.display),
    profileUrl: normalizeString(item.profileUrl || item.profile_url),
    notes: normalizeString(item.notes),
    tags: normalizeString(item.tags),
    primeStatus: item.primeStatus != null ? Number(item.primeStatus) : item.prime || 0,
    vacStatus: item.vacStatus != null ? Number(item.vacStatus) : item.vac || 0,
    gameBanStatus: item.gameBanStatus != null ? Number(item.gameBanStatus) : item.gameBan || 0,
    cooldownStatus: item.cooldownStatus != null ? Number(item.cooldownStatus) : item.cooldown || 0,
    accountStatus: normalizeString(item.accountStatus || item.status),
    rank: item.rank != null ? Number(item.rank) : null,
    level: item.level != null ? Number(item.level) : null,
    hoursPlayed: item.hoursPlayed != null ? Number(item.hoursPlayed) : null,
    rating: item.rating != null ? Number(item.rating) : null,
    inventoryValue: item.inventoryValue != null ? Number(item.inventoryValue) : 0,
    itemCount: item.itemCount != null ? Number(item.itemCount) : 0,
    rareItemCount: item.rareItemCount != null ? Number(item.rareItemCount) : 0,
    medalCount: item.medalCount != null ? Number(item.medalCount) : 0,
    medalsList: normalizeString(item.medalsList || item.medals || item.medal_list),
    lastCheckedAt: normalizeString(item.lastCheckedAt || item.last_checked_at)
  }));
}

function parseCsvLine(line) {
  const values = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(field);
      field = '';
      continue;
    }

    field += char;
  }

  values.push(field);
  return values;
}

function parseCsvFile(content) {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV import requires a header row and at least one data row');
  }

  const headers = parseCsvLine(lines[0]).map((header) => normalizeString(header).toLowerCase());

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} does not match header column count`);
    }

    const row = headers.reduce((acc, header, colIndex) => {
      acc[header] = normalizeString(values[colIndex]);
      return acc;
    }, {});

    return {
      steamId64: row.steamid64 || row.steam_id || row.id,
      username: row.username || row.userName || row.name,
      displayName: row.displayname || row.display_name || row.display,
      profileUrl: row.profileurl || row.profile_url,
      notes: row.notes,
      tags: row.tags,
      primeStatus: row.primestatus || row.prime || '0',
      vacStatus: row.vacstatus || row.vac || '0',
      gameBanStatus: row.gamebanstatus || row.gameban || '0',
      cooldownStatus: row.cooldownstatus || row.cooldown || '0',
      accountStatus: row.accountstatus || row.status,
      rank: row.rank || null,
      level: row.level || null,
      hoursPlayed: row.hoursplayed || row.hours_played || null,
      rating: row.rating || null,
      inventoryValue: row.inventoryvalue || row.inventory_value || '0',
      itemCount: row.itemcount || row.item_count || '0',
      rareItemCount: row.rareitemcount || row.rare_item_count || '0',
      medalCount: row.medalcount || row.medal_count || '0',
      medalsList: row.medalslist || row.medals || row.medal_list,
      lastCheckedAt: row.lastcheckedat || row.last_checked_at
    };
  });
}

function parseTxtFile(content) {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    const [steamId64, username, ...rest] = line.split(/[\t,]+/).map((value) => normalizeString(value));
    return {
      steamId64,
      username,
      notes: rest.join(' ')
    };
  });
}

function detectFormat(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.csv') return 'csv';
  if (ext === '.txt') return 'txt';
  if (content.trim().startsWith('[')) return 'json';
  if (content.includes(',') && content.includes('\n')) return 'csv';
  return 'txt';
}

function parseImportFile(filePath, content) {
  const format = detectFormat(filePath, content);

  if (format === 'json') return parseJsonFile(content);
  if (format === 'csv') return parseCsvFile(content);
  if (format === 'txt') return parseTxtFile(content);

  throw new Error('Unsupported import file format');
}

module.exports = {
  parseImportFile
};
