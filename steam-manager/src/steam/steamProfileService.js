/**
 * @module steamProfileService
 * @description Core service for Steam profile link operations.
 * Orchestrates generation, validation, storage, and retrieval of profile links.
 *
 * @dependencies steamLinkGenerator, steamLinkValidator, steamResolver, steamFormatter, steamConstants
 *
 * @example
 * const steamProfileService = require('./steamProfileService');
 * const result = steamProfileService.generateProfileLink('76561198012345678');
 */

const { generateProfileURL, generateCustomURL, generateBothURLs } = require('./steamLinkGenerator');
const { validateProfileURL, validateSteamId64, isSafeToOpen } = require('./steamLinkValidator');
const { resolveProfile, extractSteamId64FromURL } = require('./steamResolver');
const { normalizeURLForStorage, formatProfileForDisplay } = require('./steamFormatter');
const { VALIDATION_STATUS, HISTORY_ACTIONS } = require('./steamConstants');

/**
 * Generates a profile link for an account based on its SteamID64.
 * @param {string} steamId64 - The account's SteamID64.
 * @param {string|null} [customSlug=null] - Optional custom URL slug.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function generateProfileLink(steamId64, customSlug = null) {
  try {
    if (!steamId64) {
      return { success: false, error: 'SteamID64 is required to generate a profile link' };
    }

    const idValidation = validateSteamId64(steamId64);
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    const urlResult = generateBothURLs(steamId64, customSlug);
    if (!urlResult.success) {
      return { success: false, error: urlResult.errors ? urlResult.errors.join('; ') : 'Failed to generate URLs' };
    }

    return {
      success: true,
      data: {
        steamId64,
        steamProfileURL: normalizeURLForStorage(urlResult.profileUrl),
        customProfileURL: normalizeURLForStorage(urlResult.customUrl),
        profileValidationStatus: VALIDATION_STATUS.VALID,
        profileLastChecked: new Date().toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: `Failed to generate profile link: ${error.message}` };
  }
}

/**
 * Validates an existing profile link URL.
 * @param {string} url - The URL to validate.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function validateProfileLink(url) {
  try {
    const result = validateProfileURL(url);
    return {
      success: true,
      data: {
        ...result,
        checkedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: `Validation failed: ${error.message}` };
  }
}

/**
 * Updates a profile link with new URL data.
 * @param {Object} currentProfile - The current profile data.
 * @param {Object} updates - The updates to apply.
 * @param {string} [updates.steamProfileURL] - New Steam profile URL.
 * @param {string} [updates.customProfileURL] - New custom profile URL.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function updateProfileLink(currentProfile, updates) {
  try {
    const data = { ...currentProfile };

    if (updates.steamProfileURL !== undefined) {
      if (updates.steamProfileURL) {
        const validation = validateProfileURL(updates.steamProfileURL);
        if (!validation.valid) {
          return { success: false, error: `Invalid profile URL: ${validation.reason}` };
        }
        data.steamProfileURL = normalizeURLForStorage(updates.steamProfileURL);
      } else {
        data.steamProfileURL = null;
      }
    }

    if (updates.customProfileURL !== undefined) {
      if (updates.customProfileURL) {
        const validation = validateProfileURL(updates.customProfileURL);
        if (!validation.valid) {
          return { success: false, error: `Invalid custom URL: ${validation.reason}` };
        }
        data.customProfileURL = normalizeURLForStorage(updates.customProfileURL);
      } else {
        data.customProfileURL = null;
      }
    }

    data.profileLastChecked = new Date().toISOString();
    data.profileValidationStatus = VALIDATION_STATUS.VALID;

    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Failed to update profile link: ${error.message}` };
  }
}

/**
 * Prepares a profile link for deletion.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function deleteProfileLink(accountId) {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    return {
      success: true,
      data: {
        accountId,
        steamProfileURL: null,
        customProfileURL: null,
        profileValidationStatus: null,
        profileLastChecked: null
      }
    };
  } catch (error) {
    return { success: false, error: `Failed to delete profile link: ${error.message}` };
  }
}

/**
 * Checks if a profile URL is safe to open in an external browser.
 * @param {string} url - The URL to check.
 * @returns {{ success: boolean, safe?: boolean, url?: string, error?: string }}
 */
function openProfileLink(url) {
  try {
    if (!url) {
      return { success: false, error: 'URL is required to open a profile' };
    }

    const safetyCheck = isSafeToOpen(url);
    if (!safetyCheck.safe) {
      return { success: false, error: safetyCheck.reason };
    }

    return { success: true, safe: true, url: url.trim() };
  } catch (error) {
    return { success: false, error: `Failed to open profile link: ${error.message}` };
  }
}

/**
 * Prepares a profile URL for clipboard copy.
 * @param {string} url - The URL to copy.
 * @returns {{ success: boolean, text?: string, error?: string }}
 */
function copyProfileLink(url) {
  try {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL is required for copy' };
    }

    const trimmed = url.trim();
    if (trimmed.length === 0) {
      return { success: false, error: 'URL cannot be empty' };
    }

    return { success: true, text: trimmed };
  } catch (error) {
    return { success: false, error: `Failed to copy profile link: ${error.message}` };
  }
}

/**
 * Extracts a SteamID64 from any valid profile URL or input.
 * @param {string} input - URL or SteamID64 string.
 * @returns {{ success: boolean, steamId64?: string, error?: string }}
 */
function extractSteamID(input) {
  try {
    if (!input || typeof input !== 'string') {
      return { success: false, error: 'Input is required' };
    }

    const trimmed = input.trim();

    // Direct SteamID64
    const idValidation = validateSteamId64(trimmed);
    if (idValidation.valid) {
      return { success: true, steamId64: trimmed };
    }

    // Try extracting from URL
    const extracted = extractSteamId64FromURL(trimmed);
    if (extracted) {
      return { success: true, steamId64: extracted };
    }

    return { success: false, error: 'Could not extract SteamID64 from input' };
  } catch (error) {
    return { success: false, error: `Failed to extract SteamID: ${error.message}` };
  }
}

/**
 * Resolves a profile from any input format.
 * @param {string} input - SteamID64, URL, or custom slug.
 * @param {Object} [options] - Additional options.
 * @returns {{ success: boolean, profile?: Object, error?: string }}
 */
function resolveProfileLink(input, options = {}) {
  try {
    return resolveProfile(input, options);
  } catch (error) {
    return { success: false, error: `Failed to resolve profile: ${error.message}` };
  }
}

module.exports = {
  generateProfileLink,
  validateProfileLink,
  updateProfileLink,
  deleteProfileLink,
  openProfileLink,
  copyProfileLink,
  extractSteamID,
  resolveProfileLink
};
