/**
 * @module urlValidator
 * @description General-purpose URL validation utility.
 * Provides safe URL parsing and protocol/domain validation
 * that can be reused across the application.
 *
 * @example
 * const { isValidHttpsURL, isSafeURL } = require('./urlValidator');
 * const safe = isSafeURL('https://steamcommunity.com/profiles/123');
 */

const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'file:',
  'ftp:',
  'blob:',
  'vbscript:'
]);

const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^\[?([a-fA-F0-9:]+)\]?$/;

const LOCALHOST_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]'
]);

/**
 * Safely parses a URL string.
 * @param {string} url - The URL to parse.
 * @returns {URL|null} Parsed URL object or null if invalid.
 */
function safeParseURL(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

/**
 * Checks if a URL uses HTTPS protocol.
 * @param {string} url - The URL to check.
 * @returns {boolean}
 */
function isValidHttpsURL(url) {
  const parsed = safeParseURL(url);
  if (!parsed) return false;
  return parsed.protocol === 'https:';
}

/**
 * Checks if a hostname is an IP address.
 * @param {string} hostname - The hostname to test.
 * @returns {boolean}
 */
function isIPAddress(hostname) {
  return IPV4_PATTERN.test(hostname) || IPV6_PATTERN.test(hostname);
}

/**
 * Checks if a hostname is a localhost address.
 * @param {string} hostname - The hostname to test.
 * @returns {boolean}
 */
function isLocalhostHost(hostname) {
  return LOCALHOST_HOSTS.has(hostname.toLowerCase());
}

/**
 * Checks if a URL uses a dangerous protocol.
 * @param {string} url - The URL to check.
 * @returns {boolean}
 */
function hasDangerousProtocol(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.trim().toLowerCase();
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (lower.startsWith(proto)) return true;
  }
  return false;
}

/**
 * Validates a URL is safe to use (not dangerous protocol, not IP, not localhost).
 * @param {string} url - The URL to validate.
 * @param {Object} [options] - Validation options.
 * @param {Set<string>} [options.allowedDomains] - Set of allowed domain names.
 * @param {boolean} [options.requireHttps=true] - Require HTTPS protocol.
 * @returns {{ safe: boolean, reason?: string, parsed?: URL }}
 */
function isSafeURL(url, options = {}) {
  const { allowedDomains = null, requireHttps = true } = options;

  if (!url || typeof url !== 'string') {
    return { safe: false, reason: 'URL is required' };
  }

  if (hasDangerousProtocol(url)) {
    return { safe: false, reason: 'Dangerous protocol detected' };
  }

  const parsed = safeParseURL(url);
  if (!parsed) {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (requireHttps && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only HTTPS URLs are allowed' };
  }

  if (isLocalhostHost(parsed.hostname)) {
    return { safe: false, reason: 'Localhost URLs are not allowed' };
  }

  if (isIPAddress(parsed.hostname)) {
    return { safe: false, reason: 'IP address URLs are not allowed' };
  }

  if (allowedDomains && !allowedDomains.has(parsed.hostname.toLowerCase())) {
    return { safe: false, reason: `Domain not allowed: ${parsed.hostname}` };
  }

  return { safe: true, parsed };
}

/**
 * Escapes a string for safe use in HTML contexts.
 * @param {string} input - The input string.
 * @returns {string} Escaped string.
 */
function escapeForDisplay(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  safeParseURL,
  isValidHttpsURL,
  isIPAddress,
  isLocalhostHost,
  hasDangerousProtocol,
  isSafeURL,
  escapeForDisplay
};
