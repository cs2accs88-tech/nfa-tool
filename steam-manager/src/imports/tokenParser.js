/**
 * @module tokenParser
 * @description Parses Steam account "token" lines of the format:
 *   <SteamID64>----<JWT loginToken>----key:value----key:value----...
 *
 * Example:
 *   76561199486156161----eyJ...JWT...----csgoRank:5----earnedServiceMedal:Yes----
 *   vacStatus:Clean----primeStatus:Yes----inventoryValue:0.66----cooldown:false----
 *   rating:0----medals:6----hasRareItem:0----lastchecked:2026-07-12T22:27:12.325Z
 *
 * Fields after the token are `key:value` pairs. Values may themselves contain
 * colons (e.g. ISO dates), so only the first colon is used as the separator.
 */

const DELIMITER = '----';
const STEAM_ID64_REGEX = /^\d{17}$/;

/**
 * Interprets a yes/true style flag into 1/0.
 * @param {string} value
 * @returns {number}
 */
function toBool(value) {
  if (value == null) return 0;
  const v = String(value).trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1' ? 1 : 0;
}

/**
 * Interprets the VAC status text. "Clean" => 0 (not banned), anything else => 1.
 * @param {string} value
 * @returns {number}
 */
function vacToStatus(value) {
  if (value == null) return 0;
  const v = String(value).trim().toLowerCase();
  return v === 'clean' || v === 'none' || v === 'no' || v === '0' ? 0 : 1;
}

/**
 * Parses a number safely, returning fallback when invalid.
 * @param {string} value
 * @param {number} fallback
 * @returns {number}
 */
function toNumber(value, fallback = 0) {
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Splits a "key:value" segment on the first colon only.
 * @param {string} segment
 * @returns {[string, string]|null}
 */
function splitKeyValue(segment) {
  const idx = segment.indexOf(':');
  if (idx === -1) return null;
  const key = segment.slice(0, idx).trim().toLowerCase();
  const value = segment.slice(idx + 1).trim();
  return [key, value];
}

/**
 * Parses a single token line into a normalized account record.
 * @param {string} line
 * @param {number} index - 1-based line index (for reporting).
 * @returns {{ index: number, valid: boolean, errors: string[], record: object|null }}
 */
function parseTokenLine(line, index) {
  const errors = [];
  const raw = String(line || '').trim();

  if (raw.length === 0) {
    return { index, valid: false, errors: ['Empty line'], record: null };
  }

  const parts = raw.split(DELIMITER);
  const steamId64 = (parts[0] || '').trim();
  const loginToken = (parts[1] || '').trim();

  if (!STEAM_ID64_REGEX.test(steamId64)) {
    errors.push('Invalid or missing SteamID64 (must be 17 digits)');
  }
  if (!loginToken) {
    errors.push('Missing login token');
  }

  // Defaults
  const record = {
    steamId64,
    loginToken,
    username: steamId64, // no username in token format; default to SteamID64
    rank: null,
    earnedServiceMedal: 0,
    vacStatus: 0,
    primeStatus: 0,
    inventoryValue: 0,
    cooldownStatus: 0,
    rating: 0,
    medalCount: 0,
    rareItemCount: 0,
    lastCheckedAt: null
  };

  for (let i = 2; i < parts.length; i += 1) {
    const kv = splitKeyValue(parts[i]);
    if (!kv) continue;
    const [key, value] = kv;

    switch (key) {
      case 'csgorank':
      case 'rank':
        record.rank = value === '' ? null : Math.max(0, Math.trunc(toNumber(value, 0)));
        break;
      case 'earnedservicemedal':
        record.earnedServiceMedal = toBool(value);
        break;
      case 'vacstatus':
        record.vacStatus = vacToStatus(value);
        break;
      case 'primestatus':
        record.primeStatus = toBool(value);
        break;
      case 'inventoryvalue':
        record.inventoryValue = Math.max(0, toNumber(value, 0));
        break;
      case 'cooldown':
        record.cooldownStatus = toBool(value);
        break;
      case 'rating':
        record.rating = toNumber(value, 0);
        break;
      case 'medals':
        record.medalCount = Math.max(0, Math.trunc(toNumber(value, 0)));
        break;
      case 'hasrareitem':
        record.rareItemCount = Math.max(0, Math.trunc(toNumber(value, 0)));
        break;
      case 'lastchecked':
        record.lastCheckedAt = value || null;
        break;
      default:
        // Unknown keys are ignored (forward compatible)
        break;
    }
  }

  return { index, valid: errors.length === 0, errors, record };
}

/**
 * Parses multi-line token text into records.
 * @param {string} text
 * @returns {Array<{ index: number, valid: boolean, errors: string[], record: object|null }>}
 */
function parseTokenText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line, i) => parseTokenLine(line, i + 1));
}

module.exports = {
  parseTokenLine,
  parseTokenText,
  DELIMITER
};
