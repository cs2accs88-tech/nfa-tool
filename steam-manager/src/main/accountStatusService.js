/**
 * @module main/accountStatusService
 * @description Account status checking + maintenance.
 *
 * Two scan modes, both of which NEVER log any account out:
 *
 *   1. **Local scan** ({@link checkAllAccounts}) — instant, offline. Classifies
 *      each stored token by decoding the JWT locally (valid / expired /
 *      invalid). Touches nothing but the DB. Used by the Accounts "Refresh".
 *
 *   2. **Login scan** ({@link checkAllViaLogin}) — uses the SAME account-switch
 *      logic the Accounts tab uses ({@link module:main/steamClientLoginService})
 *      to sign in to each account one at a time and confirm the sign-in via
 *      Steam's local `ActiveUser` registry value. If an account cannot sign in,
 *      its token is marked **dead**. Switching changes the active account but
 *      never logs anyone out, and no authenticated web request is ever made.
 *      Used by the Account Status "Check All".
 *
 * VAC / Rank / Elo / Prime / Inventory are read from each account's stored
 * session data (captured at import). All DB writes are targeted column updates
 * (`lastCheckedAt` + `updateStatus`) — never a full-row rewrite and never
 * touching `loginToken`. A module-level guard prevents overlapping scans.
 */

'use strict';

const { classifyToken, isDeadToken } = require('../utils/steamToken');
const { createProductionLogger } = require('./productionLogger');

const logger = createProductionLogger('accountStatus');

/** Small pacing between accounts in the LOCAL scan so it is visibly sequential. */
const STEP_DELAY_MS = 120;

/** Retries for a transient per-account DB write failure. */
const UPDATE_RETRIES = 2;

/**
 * Login-success monitoring window per account (login scan). As soon as an
 * account's login starts, we watch for a successful sign-in for this long; if
 * Steam has not confirmed the sign-in within it, the account is classified as
 * dead and the scan moves on immediately — no long 30-50s timeout, no retries.
 * Kept as a named constant so tuning it is a one-line change. Default: 5s.
 */
const LOGIN_SUCCESS_TIMEOUT_MS = 5000;

/** Base offset to convert a SteamID64 to a legacy 32-bit account id. */
const STEAMID64_BASE = 76561197960265728n;

/** Persisted statuses we recognise (last-check result stored in updateStatus). */
const KNOWN_STATUSES = ['valid', 'expired', 'invalid', 'dead'];

/** Guards against overlapping scans (prevents duplicate/racy runs). */
let checking = false;

/**
 * @returns {import('better-sqlite3').Database}
 */
function db() {
  return require('../database/connection').getDatabase();
}

/** @param {number} ms @returns {Promise<void>} */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Monitors Steam's local `ActiveUser` value and resolves `true` as soon as the
 * target account is the signed-in user, or `false` if that has not happened
 * within `timeoutMs`. Purely local + read-only — it only reads a registry
 * value, never touches a token and never contacts the network. Polls
 * frequently so a successful login is detected quickly and a dead account is
 * given up on the moment the window elapses.
 * @param {number} steam32 - target account's 32-bit id
 * @param {number} timeoutMs
 * @param {number} [pollMs=400]
 * @returns {Promise<boolean>}
 */
async function waitForSignedIn(steam32, timeoutMs, pollMs = 400) {
  const { getActiveUser } = require('./steamClientLoginService');
  const target = Number(steam32);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getActiveUser() === target) return true;
    await wait(pollMs);
  }
  return getActiveUser() === target;
}

/**
 * Loads the columns needed for status. Never selects into a shape that could be
 * written back wholesale.
 * @returns {object[]}
 */
function loadRows() {
  return db().prepare(`
    SELECT id, steamId64, username, personaName, avatarUrl, loginToken,
           rank, rating, primeStatus, vacStatus, inventoryValue, updateStatus, lastCheckedAt
    FROM accounts
    ORDER BY updatedAt DESC
  `).all();
}

/**
 * The stored (cached) display fields shared by every status object.
 * @param {object} row
 * @param {string} [lastChecked]
 * @returns {object}
 */
function baseStatusFields(row, lastChecked) {
  return {
    id: row.id,
    steamId64: row.steamId64,
    accountName: row.personaName || row.username || String(row.steamId64),
    avatarUrl: row.avatarUrl || null,
    vacStatus: row.vacStatus ? 'banned' : 'clean',
    rank: row.rank == null ? null : row.rank,
    elo: row.rating == null ? null : row.rating,
    prime: !!row.primeStatus,
    inventoryValue: row.inventoryValue == null ? null : row.inventoryValue,
    lastChecked: lastChecked || row.lastCheckedAt || null
  };
}

/**
 * Builds a DISPLAY status object. Prefers the result stored by the last scan
 * (which may be login-verified — e.g. `dead`), falling back to the local token
 * classification when the account has never been scanned.
 * @param {object} row
 * @param {string} [lastChecked]
 * @returns {object}
 */
function rowToStatus(row, lastChecked) {
  const local = classifyToken(row.loginToken, row.steamId64);
  const tokenStatus = KNOWN_STATUSES.includes(row.updateStatus) ? row.updateStatus : local.status;
  return {
    ...baseStatusFields(row, lastChecked),
    tokenStatus,
    tokenExpiry: local.expiry,
    alive: tokenStatus === 'valid'
  };
}

/**
 * Returns the current status of every account (instant, local only).
 * @returns {object[]}
 */
function listStatuses() {
  return loadRows().map((r) => rowToStatus(r));
}

/**
 * Total / valid / dead counts (instant, local only).
 * @returns {{ total:number, valid:number, dead:number }}
 */
function computeSummary() {
  const rows = loadRows();
  let valid = 0;
  for (const r of rows) {
    if (rowToStatus(r).alive) valid += 1;
  }
  return { total: rows.length, valid, dead: rows.length - valid };
}

/**
 * Estimates remaining time from elapsed time and completed count.
 * @param {number} startedAt - epoch ms
 * @param {number} done
 * @param {number} total
 * @returns {number|null} estimated ms remaining, or null when not yet known
 */
function estimateEta(startedAt, done, total) {
  if (done <= 0) return null;
  const perItem = (Date.now() - startedAt) / done;
  return Math.max(0, Math.round(perItem * (total - done)));
}

/**
 * Persists a single account's scan result (targeted, with retries). Only
 * `lastCheckedAt` + `updateStatus` are written.
 * @param {object} update - prepared statement
 * @param {number} id
 * @param {string} ts
 * @param {string} status
 * @returns {boolean} whether the write succeeded
 */
async function persistStatus(update, id, ts, status) {
  for (let attempt = 0; attempt <= UPDATE_RETRIES; attempt += 1) {
    try {
      update.run({ id, ts, status });
      return true;
    } catch (err) {
      if (attempt < UPDATE_RETRIES) {
        await wait(50 * (attempt + 1));
      } else {
        logger.error('account update failed after retries', { id, error: err.message });
      }
    }
  }
  return false;
}

/**
 * Persists enrichment fields for an account (only known columns, only when
 * present). `COALESCE` preserves the existing value when a caller passes
 * `null` for a field. Retries transient DB errors; never throws.
 * @param {number} id
 * @param {object} patch - `{ personaName?:string, avatarUrl?:string }`
 * @returns {Promise<boolean>}
 */
async function persistEnrichment(id, patch) {
  if (!patch || typeof patch !== 'object') return true;
  const fields = ['personaName', 'avatarUrl'].filter((k) =>
    Object.prototype.hasOwnProperty.call(patch, k) && patch[k] != null && String(patch[k]).length);
  if (!fields.length) return true;

  const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
  const params = { id };
  for (const f of fields) params[f] = patch[f];
  const sql = `UPDATE accounts SET ${setSql} WHERE id = @id`;

  for (let attempt = 0; attempt <= UPDATE_RETRIES; attempt += 1) {
    try {
      db().prepare(sql).run(params);
      return true;
    } catch (err) {
      if (attempt < UPDATE_RETRIES) {
        await wait(50 * (attempt + 1));
      } else {
        logger.error('enrichment update failed after retries', { id, fields, error: err.message });
      }
    }
  }
  return false;
}

/**
 * LOCAL scan: sequentially re-validates every token offline (no sign-in).
 * @param {object} [opts]
 * @param {(p:object)=>void} [opts.onProgress]
 * @returns {Promise<{ success:boolean, results?:object[], summary?:object, error?:string }>}
 */
async function checkAllAccounts(opts = {}) {
  if (checking) return { success: false, error: 'A status check is already running.' };
  checking = true;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

  try {
    const rows = loadRows();
    const total = rows.length;
    const startedAt = Date.now();
    const update = db().prepare('UPDATE accounts SET lastCheckedAt = @ts, updateStatus = @status WHERE id = @id');

    logger.info('local status scan started', { total });

    let done = 0;
    let completed = 0;
    let failed = 0;
    let dead = 0;
    const results = [];
    const emit = (current) => onProgress({
      phase: done >= total ? 'done' : 'processing', current: current || '',
      done, total, completed, failed, dead, etaMs: estimateEta(startedAt, done, total)
    });

    for (const row of rows) {
      const local = classifyToken(row.loginToken, row.steamId64);
      const accountName = row.personaName || row.username || String(row.steamId64);
      emit(accountName);

      const now = new Date().toISOString();
      if (local.status !== 'valid') dead += 1;
      if (await persistStatus(update, row.id, now, local.status)) completed += 1;
      else failed += 1;

      results.push({ ...baseStatusFields(row, now), tokenStatus: local.status, tokenExpiry: local.expiry, alive: local.status === 'valid' });
      done += 1;
      emit(accountName);
      if (STEP_DELAY_MS > 0 && done < total) await wait(STEP_DELAY_MS);
    }

    const valid = results.filter((r) => r.alive).length;
    const summary = { total, scanned: total, valid, dead, completed, failed };
    onProgress({ phase: 'done', current: '', done: total, total, completed, failed, dead, etaMs: 0 });
    logger.info('local status scan complete', summary);
    return { success: true, results, summary };
  } catch (err) {
    logger.error('checkAllAccounts failed', err.message);
    return { success: false, error: err.message };
  } finally {
    checking = false;
  }
}

/**
 * LOGIN scan (the "Check All" workflow). For every stored account:
 *   1. switch Steam to the account + launch the client (existing switch logic),
 *   2. monitor for a successful sign-in for up to LOGIN_SUCCESS_TIMEOUT_MS (5s),
 *   3. if the sign-in is confirmed the account is "working"; if not, it is
 *      classified "dead" the instant the window elapses,
 *   4. on success, run the After Steam Enrichment Helper to collect account
 *      information and persist it (unchanged for working accounts),
 *   5. persist the token status ("valid" / "dead") + `lastCheckedAt`,
 *   6. continue with the next account — never stopping the scan on a failure.
 *
 * Fast dead-account detection: as soon as the login starts we watch for a
 * successful sign-in for only LOGIN_SUCCESS_TIMEOUT_MS (5 seconds). If Steam
 * has not confirmed the sign-in by then — or the login could not even start
 * (expired/invalid token, missing Steam) — the account is marked `dead`
 * immediately, its status is persisted, enrichment is skipped, and the scan
 * moves straight on. There are no retries and no 30-50s waits.
 *
 * Reliability:
 *   - Strictly sequential (Steam can only host one signed-in user at a time).
 *   - A module-level guard rejects any overlapping call.
 *   - Every failure is logged with its reason.
 *   - The overall scan continues regardless of per-account outcomes.
 *
 * @param {object} [opts]
 * @param {(p:object)=>void} [opts.onProgress]
 * @returns {Promise<{ success:boolean, results?:object[], summary?:object, error?:string }>}
 */
async function checkAllViaLogin(opts = {}) {
  if (checking) return { success: false, error: 'A status check is already running.' };
  checking = true;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

  try {
    const { loginToClient } = require('./steamClientLoginService');
    const { enrichAccount } = require('./afterSteamEnrichmentHelper');

    const rows = loadRows();
    const total = rows.length;
    const startedAt = Date.now();
    const update = db().prepare('UPDATE accounts SET lastCheckedAt = @ts, updateStatus = @status WHERE id = @id');

    logger.info('login status scan started', { total });

    let done = 0;
    let completed = 0;
    let failed = 0;
    let dead = 0;
    let enriched = 0;
    const results = [];
    const emit = (current, phase) => onProgress({
      phase: phase || (done >= total ? 'done' : 'processing'),
      current: current || '',
      done, total, completed, failed, dead,
      etaMs: estimateEta(startedAt, done, total)
    });

    for (const row of rows) {
      const displayName = row.personaName || row.username || String(row.steamId64);
      emit(displayName, 'processing');

      // Start the login (switch config + launch Steam), then monitor for a
      // successful sign-in for a short, fixed window. The moment Steam confirms
      // the account is signed in, it is a working account and the normal
      // checking continues below (unchanged). If the sign-in is NOT confirmed
      // within LOGIN_SUCCESS_TIMEOUT_MS, the account is classified dead right
      // away and the scan moves straight on — no 30-50s wait, no retries.
      //
      // `res` mirrors the previous verifyAccountLogin result shape so the rest
      // of the loop is untouched.
      let res = { loggedIn: false, accountName: displayName, reason: null };
      try {
        const login = await loginToClient(row.id);
        if (!login || !login.success) {
          // Definitive, instant failure (expired/invalid token, Steam missing,
          // switch already in progress) — nothing to monitor.
          res.reason = (login && login.error) || 'Sign-in could not be started';
        } else {
          res.accountName = login.accountName || displayName;
          let steam32 = null;
          try { steam32 = Number(BigInt(String(login.steamId64)) - STEAMID64_BASE); } catch { steam32 = null; }
          if (steam32 == null) {
            res.reason = 'Invalid SteamID';
          } else {
            res.loggedIn = await waitForSignedIn(steam32, LOGIN_SUCCESS_TIMEOUT_MS);
            if (!res.loggedIn) {
              res.reason = `Sign-in not confirmed within ${Math.round(LOGIN_SUCCESS_TIMEOUT_MS / 1000)}s`;
            }
          }
        }
      } catch (err) {
        // A thrown error is treated as a dead account; the scan never stops.
        logger.error('login start threw', { id: row.id, error: err.message });
        res.reason = err.message;
      }

      const loggedIn = !!(res && res.loggedIn);
      const tokenStatus = loggedIn ? 'valid' : 'dead';
      const now = new Date().toISOString();

      // 6) Persist the status immediately so a UI refresh right now reflects
      //    reality. Do this before enrichment so a dead token is visible
      //    without waiting for the (skipped) enrichment step.
      if (await persistStatus(update, row.id, now, tokenStatus)) completed += 1;
      else failed += 1;

      // 5) After Steam Enrichment Helper — live accounts only. Any failure is
      //    logged but never marks the account dead or halts the scan.
      let enrichmentPatch = {};
      if (loggedIn) {
        try {
          enrichmentPatch = enrichAccount({
            steamId64: row.steamId64,
            accountName: (res && res.accountName) || displayName
          }) || {};
          if (Object.keys(enrichmentPatch).length) {
            await persistEnrichment(row.id, enrichmentPatch);
            enriched += 1;
          }
        } catch (err) {
          logger.error('enrichment failed (non-fatal)', { id: row.id, steamId64: row.steamId64, error: err.message });
          enrichmentPatch = {};
        }
      } else {
        dead += 1;
        logger.warn('account marked dead', {
          id: row.id,
          steamId64: row.steamId64,
          reason: (res && res.reason) || 'Verification failed'
        });
      }

      // Build a result that reflects freshly-enriched values so the renderer
      // can repaint the row without a round-trip.
      const local = classifyToken(row.loginToken, row.steamId64);
      const base = baseStatusFields(row, now);
      results.push({
        ...base,
        // Freshly-read persona wins over the cached one for the UI.
        accountName: enrichmentPatch.personaName || (res && res.accountName) || base.accountName,
        avatarUrl: enrichmentPatch.avatarUrl || base.avatarUrl,
        tokenStatus,
        tokenExpiry: local.expiry,
        alive: loggedIn,
        reason: loggedIn ? null : ((res && res.reason) || 'Sign-in did not complete')
      });

      done += 1;
      emit(displayName);
    }

    const valid = results.filter((r) => r.alive).length;
    const summary = { total, scanned: total, valid, dead, completed, failed, enriched };
    onProgress({ phase: 'done', current: '', done: total, total, completed, failed, dead, etaMs: 0 });
    logger.info('login status scan complete', summary);
    return { success: true, results, summary };
  } catch (err) {
    logger.error('checkAllViaLogin failed', err.message);
    return { success: false, error: err.message };
  } finally {
    checking = false;
  }
}

/**
 * Deletes only accounts whose token is dead (expired or invalid by LOCAL
 * classification). Accounts with a valid token are never deleted, regardless of
 * VAC status or a login-scan result. Recomputed at call time; runs in a single
 * transaction so the database can never be left partially modified.
 * @returns {{ success:boolean, found:number, removed:number, remaining:number, error?:string }}
 */
function removeDeadAccounts() {
  try {
    const rows = loadRows();
    const deadIds = rows
      .filter((r) => isDeadToken(r.loginToken, r.steamId64))
      .map((r) => r.id);

    const database = db();
    const del = database.prepare('DELETE FROM accounts WHERE id = ?');
    const runAll = database.transaction((ids) => {
      for (const id of ids) del.run(id);
    });
    runAll(deadIds);

    const remaining = database.prepare('SELECT COUNT(*) AS c FROM accounts').get().c;
    logger.info('removed dead accounts', { found: deadIds.length, removed: deadIds.length, remaining });
    return { success: true, found: deadIds.length, removed: deadIds.length, remaining };
  } catch (err) {
    logger.error('removeDeadAccounts failed', err.message);
    return { success: false, found: 0, removed: 0, remaining: 0, error: err.message };
  }
}

module.exports = {
  listStatuses,
  computeSummary,
  checkAllAccounts,
  checkAllViaLogin,
  removeDeadAccounts,
  // Exposed for testing.
  _internals: { rowToStatus, estimateEta, baseStatusFields }
};
