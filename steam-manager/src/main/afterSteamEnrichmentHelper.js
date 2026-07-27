/**
 * @module main/afterSteamEnrichmentHelper
 * @description "After Steam Enrichment Helper".
 *
 * After a successful sign-in (see {@link module:main/steamClientLoginService}),
 * this helper reads any *locally available* account information from the Steam
 * client's own config files and returns a small patch that {@link
 * module:main/accountStatusService} persists to the accounts table.
 *
 * The helper is intentionally read-only and offline: it never contacts Steam's
 * web APIs (that would risk invalidating the refresh token) and never touches a
 * VDF file that Steam owns. Every helper is wrapped in try/catch so a failure
 * to enrich one field never prevents enrichment of another and never fails the
 * overall scan — the caller receives an object with only the fields we were
 * able to read.
 *
 * Fields that can be enriched locally after login:
 *  - `personaName` — from `<Steam>\config\loginusers.vdf` (Steam refreshes this
 *    on sign-in from the account's Steam Community persona).
 *  - `avatarUrl`   — best-effort path to the cached avatar on disk, only when
 *    the renderer can display it (guarded by CSP — see below).
 *
 * Fields that are NOT enrichable locally (rank, elo, prime, VAC, inventory
 * value) come from the token-import payload and remain untouched by this
 * helper. They still show up on the Accounts tab because the checker preserves
 * them and only refreshes token status + last-checked timestamp.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { KeyValues, findKeyCI } = require('../utils/steamVdf');
const { readVdfFile } = require('../utils/vdfFile');
const { createProductionLogger } = require('./productionLogger');

const logger = createProductionLogger('enrichment');

const STEAM_REG_KEY = 'HKCU\\Software\\Valve\\Steam';
const DEFAULT_STEAM_PATH = 'C:\\Program Files (x86)\\Steam';
const STEAMID64_BASE = 76561197960265728n;

/** Max avatar file size (bytes) allowed for inline data-URL embedding. */
const AVATAR_MAX_BYTES = 128 * 1024;

/**
 * Reads a field value (case-insensitive) as a string.
 * @param {KeyValues} node
 * @param {string} field
 * @returns {string|null}
 */
function readField(node, field) {
  if (!(node instanceof KeyValues)) return null;
  const key = findKeyCI(node, field);
  if (!key) return null;
  const v = node.get(key);
  return typeof v === 'string' ? v : null;
}

/**
 * Locates the Steam install directory (registry with fallback).
 * @returns {string|null}
 */
function locateSteamPath() {
  try {
    const out = execFileSync('reg', ['query', STEAM_REG_KEY], { encoding: 'utf8', windowsHide: true });
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) return m[1].trim().replace(/\//g, '\\');
  } catch { /* ignore — fall back below */ }
  return fs.existsSync(DEFAULT_STEAM_PATH) ? DEFAULT_STEAM_PATH : null;
}

/** Converts a SteamID64 string to its 32-bit account id (as a string). */
function steam32FromId64(steamId64) {
  try { return (BigInt(steamId64) - STEAMID64_BASE).toString(); } catch { return null; }
}

/**
 * Reads the account's `PersonaName` from `loginusers.vdf`. This value is
 * refreshed by Steam on each sign-in.
 * @param {string} steamPath - Steam install directory
 * @param {string} steamId64
 * @returns {string|null}
 */
function readPersonaName(steamPath, steamId64) {
  try {
    const loginUsersPath = path.join(steamPath, 'config', 'loginusers.vdf');
    if (!fs.existsSync(loginUsersPath)) return null;
    const root = readVdfFile(loginUsersPath, { logger }).root;
    const usersKey = findKeyCI(root, 'users');
    if (!usersKey) return null;
    const users = root.get(usersKey);
    const acct = users instanceof KeyValues ? users.get(String(steamId64)) : null;
    const persona = readField(acct, 'PersonaName');
    return persona && persona.trim() ? persona.trim() : null;
  } catch (err) {
    logger.warn('personaName enrichment failed', { steamId64, error: err.message });
    return null;
  }
}

/**
 * Best-effort local avatar path. Steam caches an account's avatar under
 * `<Steam>\config\avatarcache\<steamId64>.png` when available. We return a
 * `data:` URL so the renderer can display it under the current CSP (which does
 * not allow `file:`).
 * @param {string} steamPath - Steam install directory
 * @param {string} steamId64
 * @returns {string|null} `data:image/png;base64,...` or null
 */
function readAvatarDataUrl(steamPath, steamId64) {
  try {
    const candidates = [
      path.join(steamPath, 'config', 'avatarcache', `${steamId64}.png`),
      path.join(os.homedir(), 'AppData', 'Local', 'Steam', 'avatarcache', `${steamId64}.png`)
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) return null;
    const stat = fs.statSync(found);
    if (stat.size === 0 || stat.size > AVATAR_MAX_BYTES) return null;
    const b64 = fs.readFileSync(found).toString('base64');
    return `data:image/png;base64,${b64}`;
  } catch (err) {
    logger.warn('avatar enrichment failed', { steamId64, error: err.message });
    return null;
  }
}

/**
 * Enriches an account with locally-readable info collected after a successful
 * Steam sign-in.
 *
 * Contract:
 *  - Never throws — failures return an empty patch (or an incomplete patch).
 *  - Only returns fields we actually read; the caller uses this as a diff.
 *  - Purely offline + read-only.
 *
 * @param {{ steamId64:string, accountName?:string }} account
 * @returns {{ personaName?:string, avatarUrl?:string }}
 */
function enrichAccount(account) {
  const steamId64 = account && account.steamId64 ? String(account.steamId64) : null;
  if (!steamId64 || !/^\d{17}$/.test(steamId64)) return {};

  const steamPath = locateSteamPath();
  if (!steamPath) return {};

  // Sanity-check the 32-bit id, but we do not currently need it.
  if (!steam32FromId64(steamId64)) return {};

  const patch = {};

  const persona = readPersonaName(steamPath, steamId64);
  if (persona) patch.personaName = persona;

  const avatar = readAvatarDataUrl(steamPath, steamId64);
  if (avatar) patch.avatarUrl = avatar;

  if (Object.keys(patch).length) {
    logger.info('enriched account', { steamId64, fields: Object.keys(patch) });
  }
  return patch;
}

module.exports = {
  enrichAccount,
  // Exported for unit testing of the pure helpers.
  _internals: { readPersonaName, readAvatarDataUrl, locateSteamPath, steam32FromId64 }
};
