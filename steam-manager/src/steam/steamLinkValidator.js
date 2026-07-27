/**
 * @module steamLinkValidator
 * @description Validates Steam profile URLs for correctness and security.
 * Rejects dangerous protocols, invalid domains, IP addresses, and localhost.
 *
 * @dependencies steamConstants
 *
 * @example
 * const { validateProfileURL } = require('./steamLinkValidator');
 * const result = validateProfileURL('https://steamcommunity.com/profiles/76561198012345678');
 * // => { valid: true, type: 'steamid64', url: '...' }
 */

const {
  ALLOWED_HOSTNAMES,
  ALLOWED_PROTOCOL,
  BLOCKED_PROTOCOLS,
  STEAM_PROFILE_PATH,
  STEAM_CUSTOM_PATH,
  STEAM_ID64_REGEX,
  STEAM_ID64_MIN,
  STEAM_ID64_MAX,
  CUSTOM_URL_SLUG_REGEX,
  PROFILE_URL_TYPES,
  IPV4_REGEX,
  IPV6_REGEX,
  LOCALHOST_PATTERNS
} = require('./steamConstants');

/**
 * Creates a validation failure result.
 * @param {string} reason - Reason for failure.
 * @returns {{ valid: false, reason: string }}
 */
function failure(reason) {
  return { valid: false, reason };
}

/**
 * Creates a validation success result.
 * @param {string} type - URL type (steamid64 or custom).
 * @param {string} url - The validated URL.
 * @param {string|null} identifier - The extracted identifier.
 * @returns {{ valid: true, type: string, url: string, identifier: string|null }}
 */
function success(type, url, identifier) {
  return { valid: true, type, url, identifier };
}

/**
 * Checks if a hostname is an IP address.
 * @param {string} hostname - The hostname to check.
 * @returns {boolean}
 */
function isIPAddress(hostname) {
  return IPV4_REGEX.test(hostname) || IPV6_REGEX.test(hostname);
}

/**
 * Checks if a hostname is localhost or a loopback address.
 * @param {string} hostname - The hostname to check.
 * @returns {boolean}
 */
function isLocalhost(hostname) {
  return LOCALHOST_PATTERNS.has(hostname.toLowerCase());
}

/**
 * Validates a SteamID64 string for format and range.
 * @param {string} steamId64 - The SteamID64 to validate.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSteamId64(steamId64) {
  if (!steamId64 || typeof steamId64 !== 'string') {
    return { valid: false, error: 'SteamID64 is required' };
  }

  const cleaned = steamId64.trim();

  if (!STEAM_ID64_REGEX.test(cleaned)) {
    return { valid: false, error: 'SteamID64 must be exactly 17 digits' };
  }

  try {
    const id = BigInt(cleaned);
    if (id < STEAM_ID64_MIN || id > STEAM_ID64_MAX) {
      return { valid: false, error: 'SteamID64 is outside the valid range' };
    }
  } catch {
    return { valid: false, error: 'SteamID64 contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validates a Steam profile URL.
 * Checks protocol, domain, path, and extracts identifier.
 *
 * @param {string} url - The URL to validate.
 * @returns {{ valid: boolean, type?: string, url?: string, identifier?: string, reason?: string }}
 */
function validateProfileURL(url) {
  if (!url || typeof url !== 'string') {
    return failure('URL is required');
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return failure('URL cannot be empty');
  }

  // Check for blocked protocols first (before parsing)
  const lowerUrl = trimmed.toLowerCase();
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lowerUrl.startsWith(protocol)) {
      return failure(`Blocked protocol: ${protocol.replace(':', '')}`);
    }
  }

  // Parse the URL
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return failure('Invalid URL format');
  }

  // Check protocol
  if (parsed.protocol !== ALLOWED_PROTOCOL) {
    return failure(`Only HTTPS protocol is allowed, got: ${parsed.protocol.replace(':', '')}`);
  }

  // Check for localhost
  if (isLocalhost(parsed.hostname)) {
    return failure('Localhost URLs are not allowed');
  }

  // Check for IP addresses
  if (isIPAddress(parsed.hostname)) {
    return failure('IP address URLs are not allowed');
  }

  // Check domain
  if (!ALLOWED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    return failure(`Invalid domain: ${parsed.hostname}. Only steamcommunity.com is allowed`);
  }

  // Check path
  const pathname = parsed.pathname;

  if (pathname.startsWith(STEAM_PROFILE_PATH)) {
    const identifier = pathname.slice(STEAM_PROFILE_PATH.length).replace(/\/$/, '');
    const idValidation = validateSteamId64(identifier);
    if (!idValidation.valid) {
      return failure(`Invalid SteamID64 in URL: ${idValidation.error}`);
    }
    return success(PROFILE_URL_TYPES.STEAM_ID64, trimmed, identifier);
  }

  if (pathname.startsWith(STEAM_CUSTOM_PATH)) {
    const identifier = pathname.slice(STEAM_CUSTOM_PATH.length).replace(/\/$/, '');
    if (!CUSTOM_URL_SLUG_REGEX.test(identifier)) {
      return failure('Invalid custom URL slug format');
    }
    return success(PROFILE_URL_TYPES.CUSTOM, trimmed, identifier);
  }

  return failure(`Invalid path. Must start with ${STEAM_PROFILE_PATH} or ${STEAM_CUSTOM_PATH}`);
}

/**
 * Validates a URL is safe to open (security check only, less strict on path).
 * @param {string} url - The URL to check.
 * @returns {{ safe: boolean, reason?: string }}
 */
function isSafeToOpen(url) {
  if (!url || typeof url !== 'string') {
    return { safe: false, reason: 'URL is required' };
  }

  const trimmed = url.trim();
  const lowerUrl = trimmed.toLowerCase();

  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lowerUrl.startsWith(protocol)) {
      return { safe: false, reason: `Blocked protocol: ${protocol.replace(':', '')}` };
    }
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== ALLOWED_PROTOCOL) {
    return { safe: false, reason: 'Only HTTPS URLs can be opened' };
  }

  if (isLocalhost(parsed.hostname)) {
    return { safe: false, reason: 'Cannot open localhost URLs' };
  }

  if (isIPAddress(parsed.hostname)) {
    return { safe: false, reason: 'Cannot open IP address URLs' };
  }

  if (!ALLOWED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    return { safe: false, reason: `Cannot open URLs from domain: ${parsed.hostname}` };
  }

  return { safe: true };
}

module.exports = {
  validateProfileURL,
  validateSteamId64,
  isSafeToOpen,
  isIPAddress,
  isLocalhost
};
