/**
 * @module utils/steamToken
 * @description Offline (local-only) Steam refresh-token JWT utilities.
 *
 * IMPORTANT: nothing here ever contacts the network. Steam refresh tokens are
 * bound to the context that created them, and using one in a web request can
 * invalidate it — so token "validity" is determined *purely* by decoding the
 * JWT locally (structure, `sub`, `exp`). This is safe and never destroys a
 * token. A token that is well-formed and unexpired is reported "valid"; we do
 * not (and must not) probe Steam to see whether it was revoked server-side.
 *
 * Dependency-free pure JavaScript so it is unit-testable without Electron.
 */

'use strict';

/**
 * Splits a stored token into an optional account-name prefix and the pure JWT.
 * Steam token exports may be `"<login>.<header>.<payload>.<signature>"`; raw
 * JWTs are `"<header>.<payload>.<signature>"` whose header begins with `eyJ`.
 * @param {string} raw
 * @returns {{ loginPrefix: (string|null), jwt: string }}
 */
function parseStoredToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return { loginPrefix: null, jwt: '' };
  const parts = s.split('.');
  if (parts.length >= 4 && !parts[0].startsWith('eyJ')) {
    return { loginPrefix: parts[0], jwt: parts.slice(1).join('.') };
  }
  return { loginPrefix: null, jwt: s };
}

/**
 * Decodes and validates a Steam refresh-token JWT entirely offline.
 * @param {string} jwt - the pure JWT (no login prefix)
 * @param {string} expectedSteamId64
 * @returns {{ ok: boolean, reason: string, error: (string|null), expiry: (string|null), payload?: object }}
 *   `reason` is one of: valid | missing | malformed | mismatch | expired.
 */
function inspectJwt(jwt, expectedSteamId64) {
  if (!jwt) {
    return { ok: false, reason: 'missing', error: 'This account has no stored login token.', expiry: null };
  }
  const parts = String(jwt).split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed', error: 'The stored token is not a valid Steam JWT.', expiry: null };
  }
  let payload;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed', error: 'The stored token could not be decoded.', expiry: null };
  }
  const expiry = payload.exp ? new Date(Number(payload.exp) * 1000).toISOString() : null;
  if (payload.sub && String(payload.sub) !== String(expectedSteamId64)) {
    return { ok: false, reason: 'mismatch', error: 'The stored token belongs to a different SteamID.', expiry };
  }
  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
    return { ok: false, reason: 'expired', error: 'The stored token has expired. Re-import a fresh token.', expiry };
  }
  return { ok: true, reason: 'valid', error: null, expiry, payload };
}

/**
 * Classifies a stored token for status display.
 * @param {string} rawToken - the value stored in the DB (`loginToken`)
 * @param {string} steamId64
 * @returns {{ status: ('valid'|'expired'|'invalid'|'missing'), expiry: (string|null) }}
 */
function classifyToken(rawToken, steamId64) {
  const { jwt } = parseStoredToken(rawToken);
  // An absent/empty token has no usable credential — fold it into "invalid" so
  // status is a clean three-state value: valid | expired | invalid.
  if (!jwt) return { status: 'invalid', expiry: null };
  const res = inspectJwt(jwt, steamId64);
  if (res.ok) return { status: 'valid', expiry: res.expiry };
  if (res.reason === 'expired') return { status: 'expired', expiry: res.expiry };
  return { status: 'invalid', expiry: res.expiry }; // malformed | mismatch | missing
}

/**
 * Token statuses that make an account "dead" (removable). A `valid` token is
 * NEVER dead, regardless of VAC status.
 */
const DEAD_TOKEN_STATUSES = Object.freeze(['expired', 'invalid']);

/**
 * @param {string} rawToken
 * @param {string} steamId64
 * @returns {boolean} whether the token is dead (expired or invalid)
 */
function isDeadToken(rawToken, steamId64) {
  return DEAD_TOKEN_STATUSES.includes(classifyToken(rawToken, steamId64).status);
}

module.exports = {
  parseStoredToken,
  inspectJwt,
  classifyToken,
  isDeadToken,
  DEAD_TOKEN_STATUSES
};
