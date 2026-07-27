/**
 * @module steamLinkGenerator
 * @description Generates Steam profile URLs from SteamID64 values or custom vanity slugs.
 * Validates input before generating to ensure no malformed URLs are produced.
 *
 * @dependencies steamConstants
 *
 * @example
 * const { generateProfileURL, generateCustomURL } = require('./steamLinkGenerator');
 * const url = generateProfileURL('76561198012345678');
 * // => { success: true, url: 'https://steamcommunity.com/profiles/76561198012345678' }
 */

const {
  STEAM_PROFILE_URL_PREFIX,
  STEAM_CUSTOM_URL_PREFIX,
  STEAM_ID64_REGEX,
  STEAM_ID64_MIN,
  STEAM_ID64_MAX,
  CUSTOM_URL_SLUG_REGEX
} = require('./steamConstants');

/**
 * Validates that a SteamID64 string is within the valid range.
 * @param {string} steamId64 - The SteamID64 to validate.
 * @returns {boolean} True if the SteamID64 is in the valid range.
 */
function isInValidRange(steamId64) {
  try {
    const id = BigInt(steamId64);
    return id >= STEAM_ID64_MIN && id <= STEAM_ID64_MAX;
  } catch {
    return false;
  }
}

/**
 * Generates a Steam profile URL from a SteamID64.
 * @param {string} steamId64 - The 17-digit SteamID64 string.
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
function generateProfileURL(steamId64) {
  if (steamId64 === null || steamId64 === undefined) {
    return { success: false, error: 'SteamID64 is required' };
  }

  const cleaned = String(steamId64).trim().replace(/\s+/g, '');

  if (!STEAM_ID64_REGEX.test(cleaned)) {
    return { success: false, error: 'SteamID64 must be exactly 17 digits' };
  }

  if (!isInValidRange(cleaned)) {
    return { success: false, error: 'SteamID64 is outside the valid range' };
  }

  const url = `${STEAM_PROFILE_URL_PREFIX}${cleaned}`;
  return { success: true, url };
}

/**
 * Generates a Steam custom vanity URL.
 * @param {string} slug - The custom URL slug (e.g., 'example' for /id/example).
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
function generateCustomURL(slug) {
  if (!slug || typeof slug !== 'string') {
    return { success: false, error: 'Custom URL slug is required' };
  }

  const cleaned = slug.trim();

  if (!CUSTOM_URL_SLUG_REGEX.test(cleaned)) {
    return { success: false, error: 'Custom URL slug must be 2-32 characters (alphanumeric, underscores, hyphens)' };
  }

  const url = `${STEAM_CUSTOM_URL_PREFIX}${cleaned}`;
  return { success: true, url };
}

/**
 * Generates both profile URL and custom URL when both identifiers are available.
 * @param {string} steamId64 - The SteamID64.
 * @param {string|null} customSlug - Optional custom URL slug.
 * @returns {{ success: boolean, profileUrl?: string, customUrl?: string, errors?: string[] }}
 */
function generateBothURLs(steamId64, customSlug) {
  const errors = [];
  let profileUrl = null;
  let customUrl = null;

  const profileResult = generateProfileURL(steamId64);
  if (profileResult.success) {
    profileUrl = profileResult.url;
  } else {
    errors.push(profileResult.error);
  }

  if (customSlug) {
    const customResult = generateCustomURL(customSlug);
    if (customResult.success) {
      customUrl = customResult.url;
    } else {
      errors.push(customResult.error);
    }
  }

  if (!profileUrl && !customUrl) {
    return { success: false, errors };
  }

  return {
    success: true,
    profileUrl,
    customUrl,
    errors: errors.length > 0 ? errors : undefined
  };
}

module.exports = {
  generateProfileURL,
  generateCustomURL,
  generateBothURLs,
  isInValidRange
};
