/**
 * @module main/steamClientLoginService
 * @description Purely-local Steam client login "injection" + seamless account
 * switching.
 *
 * Given a stored account (SteamID64 + refresh-token JWT), this prepares the
 * local Steam installation so the next launch of the Steam client is signed in
 * as that account — WITHOUT any authenticated web request (which would
 * invalidate the token).
 *
 * ## What Steam needs to auto-login WITHOUT the account picker (the recipe)
 * Modern Steam (2023+ "new login") signs in from a cached refresh token. For a
 * fully hands-free login (no account-picker click) all of the following must
 * line up:
 *  1. `%LOCALAPPDATA%\Steam\local.vdf` →
 *     `MachineUserConfigStore/Software/Valve/Steam/ConnectCache/<key>` = the
 *     DPAPI-encrypted JWT (hex). `<key>` is `crc32(accountName)` (unsigned hex)
 *     with a trailing `1`; the DPAPI entropy is the account name.
 *  2. `<Steam>\config\loginusers.vdf` → account keyed by SteamID64 with
 *     `AccountName`, `RememberPassword "1"`, `AllowAutoLogin "1"`,
 *     `MostRecent "1"` (and every OTHER account's `MostRecent` cleared to `0`).
 *     `AllowAutoLogin "1"` is what stops Steam showing the picker.
 *  3. `<Steam>\config\config.vdf` → `.../Accounts/<name>` = `{ SteamID }`.
 *  4. `<Steam>\userdata\<steam32>\config\localconfig.vdf` → disable friends
 *     sign-in + streaming for a clean first auto-login.
 *  5. Registry `HKCU\Software\Valve\Steam\AutoLoginUser` = the login name, and
 *     Steam is launched as `steam.exe -login <name>` — which force-selects the
 *     account and bypasses the picker even with many remembered accounts.
 *
 * ## Seamless switching (this module's contract)
 * Switching accounts must behave like a dedicated account switcher: flip which
 * account is "most recent" and remembered, and change nothing else. Concretely
 * every switch is **purely additive**:
 *   - Only the *target* account's fields are written; other accounts get their
 *     `MostRecent` cleared to `0` and are otherwise left byte-for-byte intact.
 *   - Other accounts' cached tokens in `local.vdf` are never touched.
 *   - If Steam already holds a cached credential for the target (it was signed
 *     in before), the token is **not** re-written — we just switch to it,
 *     preserving Steam's own (possibly-refreshed) credential.
 *   - The shared config files are **backed up** before each switch (reversible),
 *     and every write is guarded by a preservation check that aborts + restores
 *     if any *other* account would be dropped or changed.
 *   - `loginusers.vdf` is never rebuilt from scratch: an unreadable file aborts
 *     the switch rather than wiping remembered accounts.
 *
 * The config layout follows the publicly-documented Steam token-login approach
 * (mutabless/Steam-Token-Login) and the switch semantics follow established
 * switchers (flip MostRecent/RememberPassword only, per TCNOco/TcNo-Acc-Switcher).
 * This is a clean-room JS reimplementation with merge-safe, atomic, validated
 * writes. Content was rephrased for compliance with licensing restrictions.
 *
 * ## Safety properties
 *  - Validate + encrypt before touching Steam; never throw to the caller.
 *  - Never a global logout: other accounts' credentials are preserved and
 *    asserted after every write.
 *  - Atomic, validated writes ({@link module:utils/vdfFile}); reversible via
 *    per-switch backups.
 *  - No concurrent / duplicate switches (module-level guard).
 *
 * @example
 * const { loginToClient, getActiveClient } = require('./steamClientLoginService');
 * const res = await loginToClient(accountId);
 * if (res.success) console.log('Now active:', res.accountName);
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const { KeyValues, findKeyCI, ensurePath } = require('../utils/steamVdf');
const { readVdfFile, writeVdfFile } = require('../utils/vdfFile');
const { parseStoredToken, inspectJwt } = require('../utils/steamToken');
const { createProductionLogger } = require('./productionLogger');

const logger = createProductionLogger('steamClientLogin');

/** Setting key under which the currently-injected account is persisted. */
const ACTIVE_CLIENT_SETTING = 'activeClientAccount';

/** Base offset to convert a SteamID64 to a legacy 32-bit account id. */
const STEAMID64_BASE = 76561197960265728n;

/** Default Steam install location used when the registry lookup fails. */
const DEFAULT_STEAM_PATH = 'C:\\Program Files (x86)\\Steam';

/** Registry key that holds Steam's per-user settings. */
const STEAM_REG_KEY = 'HKCU\\Software\\Valve\\Steam';

/** Steam processes terminated before rewriting config (release file locks). */
const STEAM_PROCESSES = ['steam.exe', 'steamwebhelper.exe', 'steamservice.exe'];

/** Suffix used for per-switch backups of shared config files. */
const BACKUP_SUFFIX = '.smbak-';

/** How many recent backups to retain per file. */
const BACKUP_KEEP = 5;

/**
 * Guard against concurrent/duplicate switches. Held for the entire operation
 * (including the restart delay) so a rapid second request is rejected outright.
 * @type {boolean}
 */
let switching = false;

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

/**
 * Promise-based delay that does not block the main thread.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the IEEE (reflected, poly 0xEDB88320) CRC-32 of a buffer.
 * `crc32(Buffer.from('123456789'))` === `0xCBF43926`.
 * @param {Buffer} buf
 * @returns {number} unsigned 32-bit CRC
 */
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Derives the `ConnectCache` map key for an account name: the CRC-32 (unsigned
 * hex) of the name with a trailing `1`, matching Steam's on-disk key.
 * @param {string} accountName
 * @returns {string}
 */
function connectCacheKey(accountName) {
  // crc32() already returns an unsigned 32-bit value; keep it unsigned (a JS
  // bitwise `&` would make high-bit CRCs negative and break the key).
  return (crc32(Buffer.from(accountName, 'utf8')) >>> 0).toString(16) + '1';
}

/**
 * Converts a SteamID64 to its 32-bit account id (as a string).
 * @param {string} steamId64
 * @returns {string}
 */
function steam32FromId64(steamId64) {
  return (BigInt(steamId64) - STEAMID64_BASE).toString();
}

/** Absolute path to `%LOCALAPPDATA%\Steam`, where `local.vdf` lives. */
function localAppDataSteamDir() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(base, 'Steam');
}

/**
 * Sets a field on a KeyValues node, preserving the existing key's casing if a
 * case-insensitive match already exists (Steam varies field casing).
 * @param {KeyValues} node
 * @param {string} field
 * @param {string} value
 */
function setField(node, field, value) {
  const key = findKeyCI(node, field) || field;
  node.set(key, String(value));
}

/**
 * Reads a field value (case-insensitive) as a string, or null if absent.
 * @param {KeyValues} node
 * @param {string} field
 * @returns {string|null}
 */
function getField(node, field) {
  const key = findKeyCI(node, field);
  if (!key) return null;
  const v = node.get(key);
  return typeof v === 'string' ? v : null;
}

/**
 * Read-only navigation of a KeyValues path (case-insensitive). Never mutates.
 * @param {KeyValues} root
 * @param {string[]} pathKeys
 * @returns {(KeyValues|string|null)}
 */
function navigate(root, pathKeys) {
  let node = root;
  for (const seg of pathKeys) {
    if (!(node instanceof KeyValues)) return null;
    const k = findKeyCI(node, seg);
    if (!k) return null;
    node = node.get(k);
  }
  return node;
}

// Token parsing + offline validation live in ../utils/steamToken (shared with
// the Account Status checker). `parseStoredToken` + `inspectJwt` are imported
// above; they never touch the network, so a token is never invalidated here.

/* ------------------------------------------------------------------ */
/* Steam install discovery                                             */
/* ------------------------------------------------------------------ */

/**
 * Locates the Steam installation via the registry, falling back to the default
 * path. Verifies that `steam.exe` actually exists.
 * @returns {{ steamPath: string, steamExe: string, configDir: string }}
 * @throws {Error} if Steam cannot be located
 */
function findSteamInstall() {
  let steamPath = null;
  let steamExe = null;

  try {
    const out = execFileSync('reg', ['query', STEAM_REG_KEY], { encoding: 'utf8', windowsHide: true });
    const pathMatch = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    const exeMatch = out.match(/SteamExe\s+REG_SZ\s+(.+)/i);
    if (pathMatch) steamPath = pathMatch[1].trim().replace(/\//g, '\\');
    if (exeMatch) steamExe = exeMatch[1].trim().replace(/\//g, '\\');
  } catch (err) {
    logger.warn('registry lookup for Steam path failed; using default', err.message);
  }

  if (!steamPath) steamPath = DEFAULT_STEAM_PATH;
  if (!steamExe) steamExe = path.join(steamPath, 'steam.exe');

  if (!fs.existsSync(steamExe)) {
    const fallbackExe = path.join(DEFAULT_STEAM_PATH, 'steam.exe');
    if (fs.existsSync(fallbackExe)) {
      steamPath = DEFAULT_STEAM_PATH;
      steamExe = fallbackExe;
    } else {
      throw new Error('Steam installation not found. Is Steam installed?');
    }
  }

  return { steamPath, steamExe, configDir: path.join(steamPath, 'config') };
}

/* ------------------------------------------------------------------ */
/* VDF read helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Reads a VDF file into a KeyValues tree. Missing file → empty tree. An
 * existing but unparseable file throws (we never silently rebuild a file that
 * holds other accounts' data).
 * @param {string} filePath
 * @returns {KeyValues}
 * @throws {Error} if the file exists but cannot be parsed
 */
function readVdfTree(filePath) {
  if (!fs.existsSync(filePath)) return new KeyValues();
  try {
    return readVdfFile(filePath, { logger }).root;
  } catch (err) {
    throw new Error(`Steam config file is unreadable and was left untouched: ${path.basename(filePath)} (${err.message})`);
  }
}

/**
 * Reads the AccountName Steam already recorded for a SteamID64, if any.
 * @param {string} configDir
 * @param {string} steamId64
 * @returns {string|null}
 */
function readExistingAccountName(configDir, steamId64) {
  try {
    const loginUsersPath = path.join(configDir, 'loginusers.vdf');
    if (!fs.existsSync(loginUsersPath)) return null;
    const users = navigate(readVdfFile(loginUsersPath, { logger }).root, ['users']);
    const acct = users instanceof KeyValues ? users.get(String(steamId64)) : null;
    return acct instanceof KeyValues ? getField(acct, 'AccountName') : null;
  } catch (err) {
    logger.warn('could not read existing AccountName', err.message);
    return null;
  }
}

/**
 * Resolves the Steam login (account) name using only local data, in priority:
 *   1. the name carried with the token (`"<login>.<jwt>"` exports),
 *   2. the name Steam already recorded for this SteamID on this machine,
 *   3. an imported username that is a real name (not just the SteamID),
 *   4. the SteamID string (consistent fallback — the token still authenticates).
 * @param {string} configDir
 * @param {string} steamId64
 * @param {string} username
 * @param {string|null} loginPrefix
 * @returns {string}
 */
function resolveLoginName(configDir, steamId64, username, loginPrefix) {
  if (loginPrefix && loginPrefix.trim()) return loginPrefix.trim();
  const existing = readExistingAccountName(configDir, steamId64);
  if (existing) return existing;
  if (username && String(username) !== String(steamId64)) return String(username);
  return String(steamId64);
}

/**
 * @param {KeyValues} localRoot - parsed local.vdf
 * @param {string} accountName
 * @returns {boolean} whether a ConnectCache credential already exists for the name
 */
function hasConnectCacheCredential(localRoot, accountName) {
  const cache = navigate(localRoot, ['MachineUserConfigStore', 'Software', 'Valve', 'Steam', 'ConnectCache']);
  return cache instanceof KeyValues && getField(cache, connectCacheKey(accountName)) != null;
}

/* ------------------------------------------------------------------ */
/* Backups (reversibility + recovery)                                  */
/* ------------------------------------------------------------------ */

/**
 * Best-effort timestamped backup of a file.
 * @param {string} filePath
 * @returns {string|null} the backup path, or null if nothing was backed up
 */
function backupFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const bak = `${filePath}${BACKUP_SUFFIX}${Date.now()}`;
    fs.copyFileSync(filePath, bak);
    logger.debug('backed up config file', { filePath, bak });
    return bak;
  } catch (err) {
    logger.warn('could not back up file before switch', { filePath, error: err.message });
    return null;
  }
}

/** Lists a file's backups newest-first. @returns {string[]} absolute paths */
function listBackups(filePath) {
  try {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath) + BACKUP_SUFFIX;
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith(base))
      .map((f) => ({ f, t: Number(f.slice(base.length)) || 0 }))
      .sort((a, b) => b.t - a.t)
      .map((x) => path.join(dir, x.f));
  } catch {
    return [];
  }
}

/**
 * Restores a file from its most recent backup (used to roll back a failed
 * switch so no session is lost).
 * @param {string} filePath
 * @returns {boolean}
 */
function restoreLatestBackup(filePath) {
  const baks = listBackups(filePath);
  if (!baks.length) return false;
  try {
    fs.copyFileSync(baks[0], filePath);
    logger.warn('restored file from backup after failed switch', { filePath, backup: baks[0] });
    return true;
  } catch (err) {
    logger.error('failed to restore backup', { filePath, error: err.message });
    return false;
  }
}

/** Deletes all but the newest {@link BACKUP_KEEP} backups of a file. */
function pruneBackups(filePath) {
  for (const old of listBackups(filePath).slice(BACKUP_KEEP)) {
    try { fs.unlinkSync(old); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/* DPAPI encryption/decryption (via PowerShell)                        */
/* ------------------------------------------------------------------ */

/**
 * Runs a PowerShell snippet, passing sensitive values via environment
 * variables (never on the command line) to avoid quoting/injection issues.
 * @param {string} script
 * @param {object} env - extra environment variables
 * @returns {string} trimmed stdout
 */
function runPowerShell(script, env) {
  return String(execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, ...env } }
  )).trim();
}

/**
 * DPAPI-encrypts data for the current Windows user, returning lowercase hex.
 * @param {string} data - the plaintext (the pure JWT)
 * @param {string} entropy - per-account entropy (the account name)
 * @returns {string} lowercase hex of the encrypted blob
 * @throws {Error} if PowerShell/DPAPI fails
 */
function dpapiProtectHex(data, entropy) {
  const script = [
    "$ErrorActionPreference='Stop';",
    'Add-Type -AssemblyName System.Security;',
    '$d=[Text.Encoding]::UTF8.GetBytes($env:SM_DPAPI_DATA);',
    '$e=[Text.Encoding]::UTF8.GetBytes($env:SM_DPAPI_ENTROPY);',
    '$p=[Security.Cryptography.ProtectedData]::Protect($d,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser);',
    "[BitConverter]::ToString($p).Replace('-','').ToLower()"
  ].join('');
  let hex;
  try {
    hex = runPowerShell(script, { SM_DPAPI_DATA: data, SM_DPAPI_ENTROPY: entropy }).toLowerCase();
  } catch (err) {
    throw new Error(`Failed to encrypt the token (DPAPI): ${err.message}`);
  }
  if (!/^[0-9a-f]+$/.test(hex) || hex.length < 2) {
    throw new Error('DPAPI encryption produced an unexpected result.');
  }
  return hex;
}

/**
 * DPAPI-decrypts a lowercase-hex blob for the current user. Used to verify a
 * written token round-trips (the same operation Steam performs).
 * @param {string} hex
 * @param {string} entropy
 * @returns {string} the decrypted UTF-8 string
 * @throws {Error} if PowerShell/DPAPI fails
 */
function dpapiUnprotectHex(hex, entropy) {
  const script = [
    "$ErrorActionPreference='Stop';",
    'Add-Type -AssemblyName System.Security;',
    '$h=$env:SM_DPAPI_HEX;',
    '$b=New-Object byte[] ($h.Length/2);',
    'for($i=0;$i -lt $h.Length;$i+=2){$b[$i/2]=[Convert]::ToByte($h.Substring($i,2),16)}',
    '$e=[Text.Encoding]::UTF8.GetBytes($env:SM_DPAPI_ENTROPY);',
    '$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser);',
    '[Text.Encoding]::UTF8.GetString($p)'
  ].join('');
  return runPowerShell(script, { SM_DPAPI_HEX: hex, SM_DPAPI_ENTROPY: entropy });
}

/* ------------------------------------------------------------------ */
/* VDF writers (explicit paths → testable + reusable)                  */
/* ------------------------------------------------------------------ */

/**
 * Writes the DPAPI-encrypted token into `local.vdf` under `ConnectCache`,
 * preserving every other cached credential, then verifies it decrypts back to
 * the original JWT. Aborts (throws) if any *other* account's cached token would
 * change — the caller then restores from backup.
 * @param {string} localVdfPath - `%LOCALAPPDATA%\Steam\local.vdf`
 * @param {string} accountName
 * @param {string} steamId64
 * @param {string} dpapiHex - the DPAPI-encrypted JWT (hex)
 * @param {string} jwt - the plaintext JWT, for the post-write decrypt check
 */
function writeConnectCache(localVdfPath, accountName, steamId64, dpapiHex, jwt) {
  fs.mkdirSync(path.dirname(localVdfPath), { recursive: true });
  const root = readVdfTree(localVdfPath); // throws on unreadable → never clobbered
  const cache = ensurePath(root, ['MachineUserConfigStore', 'Software', 'Valve', 'Steam', 'ConnectCache']);
  const key = connectCacheKey(accountName);

  // Snapshot other accounts' tokens so we can prove they are untouched.
  const others = new Map();
  for (const { key: k, value: v } of cache.pairs()) {
    if (k !== key && typeof v === 'string') others.set(k, v);
  }

  // Remove our own stale fallback entry (SteamID-named) if we now use a real
  // name — this prevents a duplicate cached credential for the same account.
  if (accountName !== String(steamId64)) {
    const staleKey = connectCacheKey(String(steamId64));
    if (staleKey !== key && cache.has(staleKey)) {
      cache.delete(staleKey);
      others.delete(staleKey);
      logger.info('removed stale fallback ConnectCache entry', { staleKey });
    }
  }

  cache.set(key, dpapiHex);

  // Preservation guard: no other account's token may have changed.
  for (const [k, v] of others) {
    if (getField(cache, k) !== v) {
      throw new Error("Refusing to write local.vdf: another account's cached token would change.");
    }
  }

  writeVdfFile(localVdfPath, root, { logger, validateAfterWrite: true });

  // Prove the token persisted and is decryptable (what Steam will do).
  const rereadCache = navigate(readVdfFile(localVdfPath, { logger }).root, ['MachineUserConfigStore', 'Software', 'Valve', 'Steam', 'ConnectCache']);
  const storedHex = rereadCache instanceof KeyValues ? getField(rereadCache, key) : null;
  if (!storedHex) throw new Error('ConnectCache entry was not found after writing local.vdf.');
  if (dpapiUnprotectHex(storedHex, accountName) !== jwt) {
    throw new Error('ConnectCache token failed its post-write decryption check.');
  }
  logger.info('wrote + verified ConnectCache token', { localVdfPath, key, preservedOtherTokens: others.size });
}

/**
 * Makes the target account most-recent + remembered in `loginusers.vdf`,
 * clearing MostRecent on every other account and preserving them byte-for-byte
 * otherwise. Aborts (throws) if any *other* account would be dropped or altered.
 * @param {string} loginUsersPath - `<Steam>\config\loginusers.vdf`
 * @param {string} steamId64
 * @param {string} accountName
 * @param {string} personaName
 */
function writeLoginUsers(loginUsersPath, steamId64, accountName, personaName) {
  const root = readVdfTree(loginUsersPath); // throws on unreadable → never wiped

  let usersKey = findKeyCI(root, 'users');
  if (!usersKey) {
    root.set('users', new KeyValues());
    usersKey = 'users';
  }
  const users = root.get(usersKey);
  const targetId = String(steamId64);

  // Snapshot other accounts (identity + remembered state) for the guard below.
  const others = new Map();
  for (const { key, value } of users.pairs()) {
    if (key !== targetId && value instanceof KeyValues) {
      others.set(key, { accountName: getField(value, 'AccountName'), remember: getField(value, 'RememberPassword') });
    }
  }

  // Clear MostRecent on all currently-remembered accounts (the only change we
  // make to accounts other than the target).
  for (const { value } of users.pairs()) {
    if (value instanceof KeyValues) setField(value, 'MostRecent', '0');
  }

  // Find or create the target account entry (keyed by SteamID64).
  let acct = users.get(targetId);
  if (!(acct instanceof KeyValues)) {
    acct = new KeyValues();
    users.set(targetId, acct);
  }
  setField(acct, 'AccountName', accountName);
  setField(acct, 'PersonaName', personaName || accountName);
  setField(acct, 'RememberPassword', '1');
  setField(acct, 'WantsOfflineMode', '0');
  setField(acct, 'SkipOfflineModeWarning', '0');
  // AllowAutoLogin MUST be "1" for a hands-free login: with "0" Steam shows the
  // account picker and waits for the user to click the account, which breaks
  // unattended Bulk Check. Combined with RememberPassword=1, MostRecent=1, the
  // AutoLoginUser registry value, and the cached ConnectCache token, "1" makes
  // Steam sign in automatically without the picker.
  setField(acct, 'AllowAutoLogin', '1');
  setField(acct, 'MostRecent', '1');
  setField(acct, 'Timestamp', String(Math.floor(Date.now() / 1000)));

  // Preservation guard: every other account must still be present with the
  // same identity + remembered state (only MostRecent was allowed to change).
  for (const [sid, snap] of others) {
    const v = users.get(sid);
    if (!(v instanceof KeyValues)) {
      throw new Error(`Refusing to write loginusers.vdf: account ${sid} would be removed.`);
    }
    if (getField(v, 'AccountName') !== snap.accountName || getField(v, 'RememberPassword') !== snap.remember) {
      throw new Error(`Refusing to write loginusers.vdf: account ${sid} would be altered.`);
    }
  }

  writeVdfFile(loginUsersPath, root, { logger, validateAfterWrite: true });
  logger.info('updated loginusers.vdf', { loginUsersPath, steamId64, accountName, preservedOtherAccounts: others.size });
}

/**
 * Records the SteamID under the account name in `config.vdf`. Best-effort: a
 * failure (including an unparseable file, which is left untouched) is logged
 * but never aborts the switch.
 * @param {string} configVdfPath - `<Steam>\config\config.vdf`
 * @param {string} accountName
 * @param {string} steamId64
 */
function tryWriteConfigVdf(configVdfPath, accountName, steamId64) {
  try {
    let root;
    if (fs.existsSync(configVdfPath)) {
      try {
        root = readVdfFile(configVdfPath, { logger }).root;
      } catch (err) {
        logger.warn('config.vdf unparseable; leaving it untouched', err.message);
        return;
      }
    } else {
      root = new KeyValues();
    }
    const accounts = ensurePath(root, ['InstallConfigStore', 'Software', 'Valve', 'Steam', 'Accounts', accountName]);
    setField(accounts, 'SteamID', steamId64);
    writeVdfFile(configVdfPath, root, { logger, validateAfterWrite: true });
    logger.info('updated config.vdf', { configVdfPath, accountName });
  } catch (err) {
    logger.warn('config.vdf update failed (non-fatal)', err.message);
  }
}

/**
 * Disables friends sign-in + streaming in the account's `localconfig.vdf` so
 * the first auto-login completes without prompts. Best-effort + merge-safe.
 * @param {string} localConfigPath - `<Steam>\userdata\<steam32>\config\localconfig.vdf`
 */
function tryWriteLocalConfig(localConfigPath) {
  try {
    let root;
    if (fs.existsSync(localConfigPath)) {
      try {
        root = readVdfFile(localConfigPath, { logger }).root;
      } catch (err) {
        logger.warn('localconfig.vdf unparseable; leaving it untouched', err.message);
        return;
      }
    } else {
      fs.mkdirSync(path.dirname(localConfigPath), { recursive: true });
      root = new KeyValues();
    }
    setField(ensurePath(root, ['UserLocalConfigStore', 'streaming_v2']), 'EnableStreaming', '0');
    setField(ensurePath(root, ['UserLocalConfigStore', 'friends']), 'SignIntoFriends', '0');
    writeVdfFile(localConfigPath, root, { logger, validateAfterWrite: true });
    logger.info('updated localconfig.vdf', { localConfigPath });
  } catch (err) {
    logger.warn('localconfig.vdf update failed (non-fatal)', err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Registry + process control                                          */
/* ------------------------------------------------------------------ */

/**
 * Points Steam's auto-login at the account. Best-effort (logged, non-fatal).
 * @param {string} accountName
 */
function setAutoLoginRegistry(accountName) {
  const runReg = (args) => {
    try {
      execFileSync('reg', args, { windowsHide: true, stdio: 'ignore' });
    } catch (err) {
      logger.warn('reg add failed (non-fatal)', { args, error: err.message });
    }
  };
  runReg(['add', STEAM_REG_KEY, '/v', 'AutoLoginUser', '/t', 'REG_SZ', '/d', accountName, '/f']);
  runReg(['add', STEAM_REG_KEY, '/v', 'RememberPassword', '/t', 'REG_DWORD', '/d', '1', '/f']);
}

/** @returns {boolean} whether steam.exe is currently running. */
function isSteamRunning() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH'], { encoding: 'utf8', windowsHide: true });
    return /steam\.exe/i.test(out);
  } catch {
    return false;
  }
}

/**
 * Terminates the Steam client (and helpers) if running. Never throws — a
 * "not found" exit simply means the process was not running.
 */
function killSteam() {
  for (const image of STEAM_PROCESSES) {
    try {
      execFileSync('taskkill', ['/F', '/IM', image], { windowsHide: true, stdio: 'ignore' });
      logger.info('terminated process', image);
    } catch {
      /* process was not running — ignore */
    }
  }
}

/**
 * Waits (polling) until steam.exe is no longer running, so its config files are
 * fully released before we read/modify them (prevents reading a half-written
 * file and racing Steam's own on-exit save).
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<boolean>} true if Steam is confirmed stopped
 */
async function waitForSteamExit(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isSteamRunning()) return true;
    await delay(300);
  }
  return !isSteamRunning();
}

/**
 * Launches the Steam client detached from this process.
 *
 * When `accountName` is given, Steam is started with `-login <accountName>`.
 * This deterministically selects that account and SKIPS the account picker —
 * even when several accounts are remembered (the bulk-check case) — which is
 * essential for a fully unattended login. It is safe because the caller only
 * passes a name after a valid cached credential exists for it, so Steam signs
 * in from the cached token without ever prompting for a password. Passing no
 * name performs a plain launch (used for recovery), relying on the
 * AutoLoginUser registry value + `AllowAutoLogin`.
 *
 * @param {string} steamExe
 * @param {string} [accountName] - Steam login name to force-select (skips picker)
 * @throws {Error} if the client cannot be spawned
 */
function launchSteam(steamExe, accountName) {
  try {
    const args = accountName ? ['-login', accountName] : [];
    const child = spawn(steamExe, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    logger.info('launched Steam', { steamExe, withLogin: !!accountName });
  } catch (err) {
    throw new Error(`Failed to launch Steam: ${err.message}`);
  }
}

/**
 * Reads the account Steam is currently signed in as, from
 * `HKCU\Software\Valve\Steam\ActiveProcess\ActiveUser`. This is the target
 * account's 32-bit id when signed in, or 0 at the login screen. Purely local
 * and read-only — it never touches a token.
 * @returns {number|null} the signed-in account's 32-bit id, or null if unknown
 */
function getActiveUser() {
  try {
    const out = execFileSync('reg', ['query', `${STEAM_REG_KEY}\\ActiveProcess`, '/v', 'ActiveUser'], { encoding: 'utf8', windowsHide: true });
    const m = out.match(/ActiveUser\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
    return m ? parseInt(m[1], 16) : null;
  } catch {
    return null;
  }
}

/**
 * Polls {@link getActiveUser} until Steam reports the given account as signed
 * in and the value remains stable for a short window. The stability window
 * matches the user-facing "wait for Steam to fully initialize" step: Steam can
 * briefly transition through 0 (login screen) or an intermediate value while
 * starting up, so we only declare a successful sign-in when the target id is
 * observed on multiple consecutive polls.
 *
 * @param {number} steam32 - target account's 32-bit id
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=60000] - overall wait budget
 * @param {number} [opts.pollMs=1500] - poll interval
 * @param {number} [opts.stableMs=3000] - consecutive time the value must hold
 * @returns {Promise<boolean>} true if sign-in was confirmed
 */
async function waitForActiveUser(steam32, opts = {}) {
  const target = Number(steam32);
  const timeoutMs = opts.timeoutMs || 60000;
  const pollMs = opts.pollMs || 1500;
  const stableMs = opts.stableMs != null ? opts.stableMs : 3000;
  const start = Date.now();
  let firstMatchAt = null;

  while (Date.now() - start < timeoutMs) {
    if (getActiveUser() === target) {
      if (firstMatchAt == null) firstMatchAt = Date.now();
      if (Date.now() - firstMatchAt >= stableMs) return true;
    } else {
      firstMatchAt = null;
    }
    await delay(pollMs);
  }
  // Final settle check: even if we ran out of budget, honour a value that has
  // been stable across at least one poll interval.
  return getActiveUser() === target && firstMatchAt != null;
}

/* ------------------------------------------------------------------ */
/* Active-account persistence                                          */
/* ------------------------------------------------------------------ */

/**
 * Persists the currently-active account (best-effort).
 * @param {{ accountId:number, steamId64:string, accountName:string }} info
 */
function persistActiveClient(info) {
  try {
    const { saveSetting } = require('../services/settingsService');
    saveSetting(ACTIVE_CLIENT_SETTING, JSON.stringify({ ...info, ts: new Date().toISOString() }));
  } catch (err) {
    logger.warn('could not persist active client', err.message);
  }
}

/**
 * Returns the account most recently switched to in the Steam client.
 * @returns {{ success: true, active: (object|null) }}
 */
function getActiveClient() {
  try {
    const { getSetting } = require('../services/settingsService');
    const res = getSetting(ACTIVE_CLIENT_SETTING);
    if (!res.success || !res.value) return { success: true, active: null };
    return { success: true, active: JSON.parse(res.value) };
  } catch (err) {
    logger.warn('could not read active client', err.message);
    return { success: true, active: null };
  }
}

/* ------------------------------------------------------------------ */
/* Public: switch to / inject an account                               */
/* ------------------------------------------------------------------ */

/**
 * Loads an account row (id, steamId64, username, personaName, loginToken).
 * @param {number} accountId
 * @returns {object|null}
 */
function loadAccount(accountId) {
  const { getDatabase } = require('../database/connection');
  const db = getDatabase();
  return db
    .prepare('SELECT id, steamId64, username, personaName, loginToken FROM accounts WHERE id = ?')
    .get(accountId);
}

/**
 * Switches the Steam client to the given account and restarts it. Purely local
 * and purely additive: only the target becomes active; every other remembered
 * account and cached credential is preserved.
 *
 * @param {number} accountId - the database id of the account to activate
 * @returns {Promise<{ success: boolean, accountName?: string, steamId64?: string, mode?: string, error?: string }>}
 */
async function loginToClient(accountId) {
  if (switching) {
    return { success: false, error: 'A Steam account switch is already in progress. Please wait for it to finish.' };
  }
  switching = true;

  let steamExe = null;
  let killed = false;
  let launched = false;

  try {
    // 1) Load + validate the account (before touching anything).
    const account = loadAccount(accountId);
    if (!account) return { success: false, error: 'Account not found.' };

    const steamId64 = String(account.steamId64 || '').trim();
    if (!/^\d{17}$/.test(steamId64)) {
      return { success: false, error: 'Account has an invalid SteamID64.' };
    }

    const { loginPrefix, jwt } = parseStoredToken(account.loginToken);
    const tokenCheck = inspectJwt(jwt, steamId64);
    if (!tokenCheck.ok) return { success: false, error: tokenCheck.error };

    // 2) Locate Steam (before closing anything) + derive paths.
    const install = findSteamInstall();
    steamExe = install.steamExe;
    const steam32 = steam32FromId64(steamId64);
    const localVdfPath = path.join(localAppDataSteamDir(), 'local.vdf');
    const loginUsersPath = path.join(install.configDir, 'loginusers.vdf');
    const configVdfPath = path.join(install.configDir, 'config.vdf');
    const localConfigPath = path.join(install.steamPath, 'userdata', steam32, 'config', 'localconfig.vdf');

    // 3) Resolve the login name locally.
    const accountName = resolveLoginName(install.configDir, steamId64, account.username, loginPrefix);
    const personaName = account.personaName && String(account.personaName) !== steamId64
      ? String(account.personaName)
      : accountName;

    // 4) If Steam already holds a credential for this account, switch to it
    //    without re-writing the token (seamless; preserves Steam's own token).
    let reuseExisting = false;
    try {
      if (fs.existsSync(localVdfPath)) {
        reuseExisting = hasConnectCacheCredential(readVdfFile(localVdfPath, { logger }).root, accountName);
      }
    } catch (err) {
      logger.warn('could not inspect existing credential; will inject token', err.message);
    }

    const mode = reuseExisting ? 'switch-existing' : 'inject-token';
    logger.info('starting account switch', { accountId, steamId64, accountName, steam32, mode });

    // Encrypt up-front (before closing Steam) only when we will inject.
    const dpapiHex = reuseExisting ? null : dpapiProtectHex(jwt, accountName);

    // 5) Close Steam and WAIT for it to fully release its config files, so we
    //    never read a half-written file or race Steam's on-exit save.
    killSteam();
    killed = true;
    const stopped = await waitForSteamExit(8000);
    if (!stopped) logger.warn('Steam did not confirm exit within timeout; proceeding after grace delay');
    await delay(600);

    // 6) Back up shared config files so the switch is reversible/recoverable.
    backupFileSafe(loginUsersPath);
    backupFileSafe(localVdfPath);

    // 7) Apply the switch. Any failure rolls the shared files back so no other
    //    session is lost.
    try {
      if (!reuseExisting) {
        writeConnectCache(localVdfPath, accountName, steamId64, dpapiHex, jwt);
        tryWriteLocalConfig(localConfigPath);
      } else {
        logger.info('reusing existing cached credential (no token rewrite)', { accountName });
      }
      writeLoginUsers(loginUsersPath, steamId64, accountName, personaName);
      tryWriteConfigVdf(configVdfPath, accountName, steamId64);
    } catch (writeErr) {
      restoreLatestBackup(loginUsersPath);
      restoreLatestBackup(localVdfPath);
      throw writeErr;
    }

    pruneBackups(loginUsersPath);
    pruneBackups(localVdfPath);

    // 8) Point auto-login at the account (best-effort; harmless if ignored).
    setAutoLoginRegistry(accountName);

    // 9) Relaunch Steam — it now signs in as the selected account. Force the
    //    account with `-login <name>` so the picker is skipped entirely. Only
    //    pass a real login name; if all we have is the SteamID fallback, launch
    //    plain and rely on AutoLoginUser + AllowAutoLogin + the cached token.
    const launchName = accountName && accountName !== steamId64 ? accountName : null;
    launchSteam(steamExe, launchName);
    launched = true;

    // 10) Remember which account is active (for the UI badge).
    persistActiveClient({ accountId: account.id, steamId64, accountName });

    logger.info('account switch complete', { accountId, steamId64, accountName, mode });
    return { success: true, accountName, steamId64, mode };
  } catch (err) {
    logger.error('account switch failed', { accountId, error: err.message, stack: err.stack });
    // If we closed Steam but failed before relaunching, bring it back.
    if (killed && !launched && steamExe) {
      try { launchSteam(steamExe); } catch { /* best-effort recovery */ }
    }
    return { success: false, error: err.message || 'Steam account switch failed.' };
  } finally {
    switching = false;
  }
}

/**
 * Verifies whether an account can actually sign in, by switching to it with the
 * SAME local logic the Accounts tab uses ({@link loginToClient}) and then
 * confirming via Steam's `ActiveUser` registry value that the client signed in.
 *
 * This never logs any account out — switching only changes which account is
 * active — and never makes an authenticated web request. If the switch fails
 * (e.g. the token is expired/invalid) or Steam does not confirm sign-in within
 * the time limit, the token is reported as not logged in ("dead").
 *
 * @param {number} accountId
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=60000] - how long to wait for sign-in
 * @returns {Promise<{ loggedIn:boolean, steamId64:(string|null), accountName:(string|null), reason:(string|null) }>}
 */
async function verifyAccountLogin(accountId, opts = {}) {
  const timeoutMs = opts.timeoutMs || 60000;

  let res;
  try {
    res = await loginToClient(accountId);
  } catch (err) {
    return { loggedIn: false, steamId64: null, accountName: null, reason: err.message };
  }

  if (!res.success) {
    // The switch itself failed (token expired/invalid/malformed, Steam missing).
    return { loggedIn: false, steamId64: res.steamId64 || null, accountName: res.accountName || null, reason: res.error || 'Sign-in failed' };
  }

  let steam32;
  try {
    steam32 = Number(BigInt(res.steamId64) - STEAMID64_BASE);
  } catch {
    return { loggedIn: false, steamId64: res.steamId64, accountName: res.accountName, reason: 'Invalid SteamID' };
  }

  const loggedIn = await waitForActiveUser(steam32, { timeoutMs });
  logger.info('login verification', { accountId, steamId64: res.steamId64, loggedIn });
  return {
    loggedIn,
    steamId64: res.steamId64,
    accountName: res.accountName,
    reason: loggedIn ? null : 'Steam did not confirm sign-in within the time limit'
  };
}

module.exports = {
  loginToClient,
  verifyAccountLogin,
  getActiveUser,
  getActiveClient,
  // Exported for unit/integration testing of the pure + file-level helpers.
  _internals: {
    crc32,
    connectCacheKey,
    steam32FromId64,
    parseStoredToken,
    inspectJwt,
    resolveLoginName,
    hasConnectCacheCredential,
    dpapiProtectHex,
    dpapiUnprotectHex,
    writeConnectCache,
    writeLoginUsers,
    tryWriteConfigVdf,
    tryWriteLocalConfig,
    backupFileSafe,
    restoreLatestBackup,
    pruneBackups,
    navigate
  }
};
