/**
 * @module steamFormatter
 * @description Formats Steam profile data for display and storage.
 * Normalizes URLs, formats display strings, and prepares data for UI.
 *
 * @dependencies steamConstants
 *
 * @example
 * const { formatProfileForDisplay } = require('./steamFormatter');
 * const display = formatProfileForDisplay(profile);
 */

const {
  STEAM_PROFILE_URL_PREFIX,
  STEAM_CUSTOM_URL_PREFIX,
  PROFILE_URL_TYPES,
  VALIDATION_STATUS
} = require('./steamConstants');

/**
 * Formats a profile object for UI display.
 * @param {Object} profile - The profile data from the database.
 * @returns {Object} Formatted profile for display.
 */
function formatProfileForDisplay(profile) {
  if (!profile) {
    return null;
  }

  return {
    steamID64: profile.steamId64 || profile.steamID64 || null,
    profileURL: profile.steamProfileURL || profile.profileURL || null,
    customURL: profile.customProfileURL || profile.customURL || null,
    validationStatus: profile.profileValidationStatus || VALIDATION_STATUS.UNCHECKED,
    lastChecked: profile.profileLastChecked || null,
    displayURL: getDisplayURL(profile),
    urlType: getURLType(profile)
  };
}

/**
 * Gets the best URL to display for a profile.
 * Prefers custom URL over SteamID64 URL.
 * @param {Object} profile - The profile data.
 * @returns {string|null} The best URL to display.
 */
function getDisplayURL(profile) {
  if (profile.customProfileURL || profile.customURL) {
    return profile.customProfileURL || profile.customURL;
  }
  if (profile.steamProfileURL || profile.profileURL) {
    return profile.steamProfileURL || profile.profileURL;
  }
  return null;
}

/**
 * Determines the URL type from a profile object.
 * @param {Object} profile - The profile data.
 * @returns {string} The URL type.
 */
function getURLType(profile) {
  if (profile.customProfileURL || profile.customURL) {
    return PROFILE_URL_TYPES.CUSTOM;
  }
  if (profile.steamProfileURL || profile.profileURL) {
    return PROFILE_URL_TYPES.STEAM_ID64;
  }
  return PROFILE_URL_TYPES.UNKNOWN;
}

/**
 * Formats a SteamID64 for display (truncated with ellipsis for UI).
 * @param {string} steamId64 - The SteamID64.
 * @param {number} [maxLength=17] - Maximum display length.
 * @returns {string} Formatted SteamID64.
 */
function formatSteamId64ForDisplay(steamId64, maxLength = 17) {
  if (!steamId64) return 'N/A';
  const id = String(steamId64).trim();
  if (id.length <= maxLength) return id;
  return `${id.substring(0, maxLength - 3)}...`;
}

/**
 * Formats a URL for compact display.
 * @param {string} url - The full URL.
 * @param {number} [maxLength=50] - Maximum display length.
 * @returns {string} Truncated URL for display.
 */
function formatURLForDisplay(url, maxLength = 50) {
  if (!url) return 'No profile link';
  const display = url.replace('https://', '').replace('www.', '');
  if (display.length <= maxLength) return display;
  return `${display.substring(0, maxLength - 3)}...`;
}

/**
 * Formats validation status for display with an appropriate label.
 * @param {string} status - The validation status.
 * @returns {{ label: string, className: string }}
 */
function formatValidationStatus(status) {
  switch (status) {
    case VALIDATION_STATUS.VALID:
      return { label: 'Valid', className: 'status-valid' };
    case VALIDATION_STATUS.INVALID:
      return { label: 'Invalid', className: 'status-invalid' };
    case VALIDATION_STATUS.PENDING:
      return { label: 'Pending', className: 'status-pending' };
    case VALIDATION_STATUS.UNCHECKED:
    default:
      return { label: 'Unchecked', className: 'status-unchecked' };
  }
}

/**
 * Normalizes a profile URL for storage (lowercase domain, trim whitespace).
 * @param {string} url - The URL to normalize.
 * @returns {string|null} The normalized URL or null if invalid.
 */
function normalizeURLForStorage(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    // Remove trailing slash for consistency
    let normalized = parsed.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Extracts a slug from a custom Steam URL.
 * @param {string} customURL - The custom URL.
 * @returns {string|null} The extracted slug or null.
 */
function extractSlugFromCustomURL(customURL) {
  if (!customURL || typeof customURL !== 'string') return null;
  try {
    const parsed = new URL(customURL);
    const path = parsed.pathname;
    if (path.startsWith('/id/')) {
      return path.slice(4).replace(/\/$/, '') || null;
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

module.exports = {
  formatProfileForDisplay,
  getDisplayURL,
  getURLType,
  formatSteamId64ForDisplay,
  formatURLForDisplay,
  formatValidationStatus,
  normalizeURLForStorage,
  extractSlugFromCustomURL
};
