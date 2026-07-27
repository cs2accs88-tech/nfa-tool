/**
 * @module profileService
 * @description Application-level service for managing profile links.
 * Integrates steam modules with database persistence and history logging.
 *
 * @dependencies
 * - ../database/connection
 * - ../steam/steamProfileService
 * - ../steam/steamLinkValidator
 * - ../steam/steamConstants
 * - ../history/profileHistoryService
 *
 * @example
 * const profileService = require('./profileService');
 * const result = profileService.generateAndSaveProfileLink(accountId);
 */

const { getDatabase } = require('../database/connection');
const steamProfileService = require('../steam/steamProfileService');
const { validateProfileURL, isSafeToOpen } = require('../steam/steamLinkValidator');
const { VALIDATION_STATUS, HISTORY_ACTIONS } = require('../steam/steamConstants');
const historyService = require('../history/profileHistoryService');

/**
 * Generates and saves a profile link for an account.
 * @param {number} accountId - The account's database ID.
 * @param {string} [changedBy='system'] - Who triggered the generation.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function generateAndSaveProfileLink(accountId, changedBy = 'system') {
  try {
    const db = getDatabase();
    const account = db.prepare('SELECT id, steamId64, steamProfileURL FROM accounts WHERE id = ?').get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    if (!account.steamId64) {
      return { success: false, error: 'Account does not have a SteamID64' };
    }

    const result = steamProfileService.generateProfileLink(account.steamId64);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const { steamProfileURL, customProfileURL, profileValidationStatus, profileLastChecked } = result.data;

    db.prepare(`
      UPDATE accounts SET
        steamProfileURL = ?,
        customProfileURL = ?,
        profileValidationStatus = ?,
        profileLastChecked = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(steamProfileURL, customProfileURL, profileValidationStatus, profileLastChecked, new Date().toISOString(), accountId);

    // Log history
    historyService.logProfileCreated(accountId, steamProfileURL, changedBy);

    return {
      success: true,
      data: {
        accountId,
        steamProfileURL,
        customProfileURL,
        profileValidationStatus,
        profileLastChecked
      }
    };
  } catch (error) {
    return { success: false, error: `Failed to generate and save profile link: ${error.message}` };
  }
}

/**
 * Validates and updates the profile link status for an account.
 * @param {number} accountId - The account's database ID.
 * @param {string} [changedBy='system'] - Who triggered the validation.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function validateAndUpdateProfileLink(accountId, changedBy = 'system') {
  try {
    const db = getDatabase();
    const account = db.prepare('SELECT id, steamProfileURL, customProfileURL FROM accounts WHERE id = ?').get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const urlToValidate = account.steamProfileURL || account.customProfileURL;
    if (!urlToValidate) {
      return { success: false, error: 'Account has no profile URL to validate' };
    }

    const validation = validateProfileURL(urlToValidate);
    const status = validation.valid ? VALIDATION_STATUS.VALID : VALIDATION_STATUS.INVALID;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE accounts SET
        profileValidationStatus = ?,
        profileLastChecked = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(status, now, now, accountId);

    historyService.logProfileValidated(accountId, urlToValidate, changedBy);

    return {
      success: true,
      data: {
        accountId,
        url: urlToValidate,
        valid: validation.valid,
        status,
        reason: validation.reason || null,
        checkedAt: now
      }
    };
  } catch (error) {
    return { success: false, error: `Failed to validate profile link: ${error.message}` };
  }
}

/**
 * Updates the profile link for an account.
 * @param {number} accountId - The account's database ID.
 * @param {Object} updates - The URL updates.
 * @param {string} [updates.steamProfileURL] - New profile URL.
 * @param {string} [updates.customProfileURL] - New custom URL.
 * @param {string} [changedBy='user'] - Who triggered the update.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function updateProfileLink(accountId, updates, changedBy = 'user') {
  try {
    const db = getDatabase();
    const account = db.prepare('SELECT id, steamProfileURL, customProfileURL FROM accounts WHERE id = ?').get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const current = {
      steamProfileURL: account.steamProfileURL,
      customProfileURL: account.customProfileURL
    };

    const result = steamProfileService.updateProfileLink(current, updates);
    if (!result.success) {
      return result;
    }

    const { steamProfileURL, customProfileURL, profileValidationStatus, profileLastChecked } = result.data;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE accounts SET
        steamProfileURL = ?,
        customProfileURL = ?,
        profileValidationStatus = ?,
        profileLastChecked = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(steamProfileURL, customProfileURL, profileValidationStatus, profileLastChecked, now, accountId);

    // Log history for each URL that changed
    if (updates.steamProfileURL !== undefined && updates.steamProfileURL !== account.steamProfileURL) {
      historyService.logProfileUpdated(accountId, account.steamProfileURL, steamProfileURL, changedBy);
    }
    if (updates.customProfileURL !== undefined && updates.customProfileURL !== account.customProfileURL) {
      historyService.logProfileUpdated(accountId, account.customProfileURL, customProfileURL, changedBy);
    }

    return {
      success: true,
      data: { accountId, steamProfileURL, customProfileURL, profileValidationStatus, profileLastChecked }
    };
  } catch (error) {
    return { success: false, error: `Failed to update profile link: ${error.message}` };
  }
}

/**
 * Removes the profile link from an account.
 * @param {number} accountId - The account's database ID.
 * @param {string} [changedBy='user'] - Who triggered the deletion.
 * @returns {{ success: boolean, error?: string }}
 */
function deleteProfileLink(accountId, changedBy = 'user') {
  try {
    const db = getDatabase();
    const account = db.prepare('SELECT id, steamProfileURL, customProfileURL FROM accounts WHERE id = ?').get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const oldURL = account.steamProfileURL || account.customProfileURL;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE accounts SET
        steamProfileURL = NULL,
        customProfileURL = NULL,
        profileValidationStatus = NULL,
        profileLastChecked = NULL,
        updatedAt = ?
      WHERE id = ?
    `).run(now, accountId);

    if (oldURL) {
      historyService.logProfileDeleted(accountId, oldURL, changedBy);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `Failed to delete profile link: ${error.message}` };
  }
}

/**
 * Gets the profile link data for an account.
 * @param {number} accountId - The account's database ID.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function getProfileLink(accountId) {
  try {
    const db = getDatabase();
    const account = db.prepare(
      'SELECT id, steamId64, steamProfileURL, customProfileURL, profileValidationStatus, profileLastChecked FROM accounts WHERE id = ?'
    ).get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    return { success: true, data: account };
  } catch (error) {
    return { success: false, error: `Failed to get profile link: ${error.message}` };
  }
}

/**
 * Gets the profile link history for an account.
 * @param {number} accountId - The account's database ID.
 * @param {Object} [options] - Query options.
 * @returns {{ success: boolean, history?: Array, error?: string }}
 */
function getProfileLinkHistory(accountId, options = {}) {
  return historyService.getProfileHistory(accountId, options);
}

/**
 * Prepares a profile URL for safe opening in an external browser.
 * @param {number} accountId - The account's database ID.
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
function openProfile(accountId) {
  try {
    const db = getDatabase();
    const account = db.prepare(
      'SELECT steamProfileURL, customProfileURL FROM accounts WHERE id = ?'
    ).get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const url = account.customProfileURL || account.steamProfileURL;
    if (!url) {
      return { success: false, error: 'Account has no profile URL' };
    }

    const result = steamProfileService.openProfileLink(url);
    return result;
  } catch (error) {
    return { success: false, error: `Failed to open profile: ${error.message}` };
  }
}

/**
 * Gets the profile URL text for clipboard copy.
 * @param {number} accountId - The account's database ID.
 * @returns {{ success: boolean, text?: string, error?: string }}
 */
function copyProfile(accountId) {
  try {
    const db = getDatabase();
    const account = db.prepare(
      'SELECT steamProfileURL, customProfileURL FROM accounts WHERE id = ?'
    ).get(accountId);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const url = account.customProfileURL || account.steamProfileURL;
    if (!url) {
      return { success: false, error: 'Account has no profile URL to copy' };
    }

    return steamProfileService.copyProfileLink(url);
  } catch (error) {
    return { success: false, error: `Failed to copy profile: ${error.message}` };
  }
}

/**
 * Batch generates profile links for all accounts missing one.
 * @param {string} [changedBy='system'] - Who triggered the batch generation.
 * @returns {{ success: boolean, updatedCount?: number, errors?: Array, error?: string }}
 */
function batchGenerateProfileLinks(changedBy = 'system') {
  try {
    const db = getDatabase();
    const accounts = db.prepare(
      'SELECT id, steamId64 FROM accounts WHERE steamProfileURL IS NULL AND steamId64 IS NOT NULL'
    ).all();

    if (accounts.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    let updatedCount = 0;
    const errors = [];

    for (const account of accounts) {
      const result = generateAndSaveProfileLink(account.id, changedBy);
      if (result.success) {
        updatedCount += 1;
      } else {
        errors.push({ accountId: account.id, error: result.error });
      }
    }

    return { success: true, updatedCount, errors };
  } catch (error) {
    return { success: false, error: `Batch generation failed: ${error.message}` };
  }
}

module.exports = {
  generateAndSaveProfileLink,
  validateAndUpdateProfileLink,
  updateProfileLink,
  deleteProfileLink,
  getProfileLink,
  getProfileLinkHistory,
  openProfile,
  copyProfile,
  batchGenerateProfileLinks
};
