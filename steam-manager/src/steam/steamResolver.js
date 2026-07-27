/**
 * @module steamResolver
 * @description Resolves various Steam profile input formats into a normalized profile object.
 * Accepts SteamID64, full profile URLs, or custom URLs and produces a consistent output.
 *
 * @dependencies steamConstants, steamLinkGenerator, steamLinkValidator
 *
 * @example
 * const { resolveProfile } = require('./steamResolver');
 * const result = resolveProfile('76561198012345678');
 * // => { success: true, profile: { steamID64: '...', profileURL: '...', customURL: null, type: 'steamid64' } }
 */

const {
  STEAM_PROFILE_PATH,
  STEAM_CUSTOM_PATH,
  STEAM_COMMUNITY_BASE,
  PROFILE_URL_TYPES,
  STEAM_ID64_REGEX
} = require('./steamConstants');
const { generateProfileURL, generateCustomURL } = require('./steamLinkGenerator');
const { validateProfileURL, validateSteamId64 } = require('./steamLinkValidator');

/**
 * Attempts to extract a SteamID64 from a profile URL.
 * @param {string} url - The URL to extract from.
 * @returns {string|null} The extracted SteamID64 or null.
 */
function extractSteamId64FromURL(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith(STEAM_PROFILE_PATH)) {
      const id = parsed.pathname.slice(STEAM_PROFILE_PATH.length).replace(/\/$/, '');
      if (STEAM_ID64_REGEX.test(id)) {
        return id;
      }
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/**
 * Attempts to extract a custom URL slug from a profile URL.
 * @param {string} url - The URL to extract from.
 * @returns {string|null} The extracted slug or null.
 */
function extractCustomSlugFromURL(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith(STEAM_CUSTOM_PATH)) {
      const slug = parsed.pathname.slice(STEAM_CUSTOM_PATH.length).replace(/\/$/, '');
      if (slug.length > 0) {
        return slug;
      }
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/**
 * Detects the type of input provided.
 * @param {string} input - The input string to classify.
 * @returns {'steamid64'|'profileUrl'|'customUrl'|'slug'|'unknown'}
 */
function detectInputType(input) {
  if (!input || typeof input !== 'string') {
    return 'unknown';
  }

  const trimmed = input.trim();

  // Check if it's a raw SteamID64
  if (STEAM_ID64_REGEX.test(trimmed)) {
    return 'steamid64';
  }

  // Check if it's a URL
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith(STEAM_PROFILE_PATH)) {
      return 'profileUrl';
    }
    if (parsed.pathname.startsWith(STEAM_CUSTOM_PATH)) {
      return 'customUrl';
    }
  } catch {
    // Not a URL, might be a slug
  }

  // Could be a custom URL slug
  if (/^[a-zA-Z0-9_-]{2,32}$/.test(trimmed)) {
    return 'slug';
  }

  return 'unknown';
}

/**
 * Resolves any supported input format into a normalized profile object.
 *
 * @param {string} input - SteamID64, profile URL, custom URL, or custom slug.
 * @param {Object} [options] - Additional options.
 * @param {string} [options.steamId64] - Known SteamID64 (used when input is a custom URL).
 * @param {string} [options.customSlug] - Known custom slug.
 * @returns {{ success: boolean, profile?: Object, error?: string }}
 */
function resolveProfile(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Input is required for profile resolution' };
  }

  const trimmed = input.trim();
  const inputType = detectInputType(trimmed);

  switch (inputType) {
    case 'steamid64': {
      const validation = validateSteamId64(trimmed);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const urlResult = generateProfileURL(trimmed);
      const profile = {
        steamID64: trimmed,
        profileURL: urlResult.success ? urlResult.url : null,
        customURL: options.customSlug ? generateCustomURL(options.customSlug).url || null : null,
        type: PROFILE_URL_TYPES.STEAM_ID64
      };
      return { success: true, profile };
    }

    case 'profileUrl': {
      const urlValidation = validateProfileURL(trimmed);
      if (!urlValidation.valid) {
        return { success: false, error: urlValidation.reason };
      }

      const steamId64 = extractSteamId64FromURL(trimmed);
      const profile = {
        steamID64: steamId64,
        profileURL: trimmed,
        customURL: options.customSlug ? generateCustomURL(options.customSlug).url || null : null,
        type: PROFILE_URL_TYPES.STEAM_ID64
      };
      return { success: true, profile };
    }

    case 'customUrl': {
      const urlValidation = validateProfileURL(trimmed);
      if (!urlValidation.valid) {
        return { success: false, error: urlValidation.reason };
      }

      const slug = extractCustomSlugFromURL(trimmed);
      const steamId64 = options.steamId64 || null;
      let profileURL = null;

      if (steamId64) {
        const urlResult = generateProfileURL(steamId64);
        profileURL = urlResult.success ? urlResult.url : null;
      }

      const profile = {
        steamID64: steamId64,
        profileURL,
        customURL: trimmed,
        type: PROFILE_URL_TYPES.CUSTOM
      };
      return { success: true, profile };
    }

    case 'slug': {
      const customResult = generateCustomURL(trimmed);
      if (!customResult.success) {
        return { success: false, error: customResult.error };
      }

      const steamId64 = options.steamId64 || null;
      let profileURL = null;

      if (steamId64) {
        const urlResult = generateProfileURL(steamId64);
        profileURL = urlResult.success ? urlResult.url : null;
      }

      const profile = {
        steamID64: steamId64,
        profileURL,
        customURL: customResult.url,
        type: PROFILE_URL_TYPES.CUSTOM
      };
      return { success: true, profile };
    }

    default:
      return { success: false, error: 'Unable to determine input type. Provide a valid SteamID64, profile URL, or custom URL slug.' };
  }
}

module.exports = {
  resolveProfile,
  detectInputType,
  extractSteamId64FromURL,
  extractCustomSlugFromURL
};
