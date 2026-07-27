/**
 * @module profileController
 * @description Controller layer for profile link operations.
 * Handles request validation and delegates to the profile service.
 * Designed to be called from IPC handlers or direct invocation.
 *
 * @dependencies ../services/profileService, ../steam/steamProfileService
 *
 * @example
 * const profileController = require('./profileController');
 * const result = profileController.generateProfileLink(accountId);
 */

const profileService = require('../services/profileService');
const { extractSteamID, resolveProfileLink } = require('../steam/steamProfileService');

/**
 * Generates a profile link for an account.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function generateProfileLink(accountId) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.generateAndSaveProfileLink(accountId, 'user');
}

/**
 * Validates the profile link for an account.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function validateProfileLink(accountId) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.validateAndUpdateProfileLink(accountId, 'user');
}

/**
 * Updates the profile link for an account.
 * @param {number} accountId - The account ID.
 * @param {Object} updates - URL updates.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function updateProfileLink(accountId, updates) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  if (!updates || typeof updates !== 'object') {
    return { success: false, error: 'Updates object is required' };
  }
  return profileService.updateProfileLink(accountId, updates, 'user');
}

/**
 * Deletes the profile link for an account.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, error?: string }}
 */
function deleteProfileLink(accountId) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.deleteProfileLink(accountId, 'user');
}

/**
 * Opens a profile in the external browser.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
function openProfileLink(accountId) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.openProfile(accountId);
}

/**
 * Copies the profile URL for an account.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, text?: string, error?: string }}
 */
function copyProfileLink(accountId) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.copyProfile(accountId);
}

/**
 * Gets the profile link data for an account.
 * @param {number} accountId - The account ID.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function getProfileLink(accountId) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.getProfileLink(accountId);
}

/**
 * Gets the profile link history for an account.
 * @param {number} accountId - The account ID.
 * @param {Object} [options] - Pagination options.
 * @returns {{ success: boolean, history?: Array, error?: string }}
 */
function getProfileHistory(accountId, options = {}) {
  if (!accountId || !Number.isInteger(accountId)) {
    return { success: false, error: 'Valid account ID is required' };
  }
  return profileService.getProfileLinkHistory(accountId, options);
}

/**
 * Extracts a SteamID64 from a URL or string input.
 * @param {string} input - The input to extract from.
 * @returns {{ success: boolean, steamId64?: string, error?: string }}
 */
function extractSteamId(input) {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Input string is required' };
  }
  return extractSteamID(input);
}

/**
 * Resolves a profile from any input format.
 * @param {string} input - SteamID64, URL, or slug.
 * @param {Object} [options] - Resolution options.
 * @returns {{ success: boolean, profile?: Object, error?: string }}
 */
function resolveProfile(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Input string is required' };
  }
  return resolveProfileLink(input, options);
}

/**
 * Batch generates profile links for all accounts missing one.
 * @returns {{ success: boolean, updatedCount?: number, errors?: Array, error?: string }}
 */
function batchGenerateLinks() {
  return profileService.batchGenerateProfileLinks('user');
}

module.exports = {
  generateProfileLink,
  validateProfileLink,
  updateProfileLink,
  deleteProfileLink,
  openProfileLink,
  copyProfileLink,
  getProfileLink,
  getProfileHistory,
  extractSteamId,
  resolveProfile,
  batchGenerateLinks
};
