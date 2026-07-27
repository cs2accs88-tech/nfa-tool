/**
 * Validation helpers for Steam Manager account data.
 */

const STEAM_ID_LENGTH = 17;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const INVENTORY_PRIVACY_VALUES = ['public', 'private', 'friends-only'];

function isValidSteamId64(value) {
  return typeof value === 'string' && /^\d+$/.test(value) && value.length === STEAM_ID_LENGTH;
}

function isValidNonNegativeInteger(value) {
  return value === null || value === undefined || (Number.isInteger(value) && value >= 0);
}

function isValidNonNegativeNumber(value) {
  return value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isValidBooleanField(value) {
  return value === undefined || value === null || value === true || value === false || value === 1 || value === 0;
}

function isValidDate(value) {
  return value === null || value === undefined || (typeof value === 'string' && DATE_REGEX.test(value));
}

function sanitizeString(value) {
  return value === null || value === undefined ? null : String(value).trim();
}

function validateAccount(account) {
  const errors = [];

  if (!isValidSteamId64(account.steamId64)) {
    errors.push('SteamID64 must be a 17-digit numeric string.');
  }

  if (!account.username || typeof account.username !== 'string') {
    errors.push('Username is required and must be a string.');
  }

  if (!isValidNonNegativeInteger(account.competitiveRank)) {
    errors.push('Competitive rank must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeInteger(account.premierRating)) {
    errors.push('Premier rating must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeInteger(account.level)) {
    errors.push('Level must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeInteger(account.xp)) {
    errors.push('XP must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeNumber(account.hoursPlayed)) {
    errors.push('Hours played must be a non-negative number or null.');
  }

  if (!isValidNonNegativeNumber(account.inventoryValue)) {
    errors.push('Inventory value must be a non-negative number.');
  }

  if (!isValidNonNegativeInteger(account.inventoryItems)) {
    errors.push('Inventory items must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeInteger(account.rareItems)) {
    errors.push('Rare items must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeInteger(account.serviceMedals)) {
    errors.push('Service medals count must be a non-negative integer or null.');
  }

  if (!isValidNonNegativeInteger(account.achievementCount)) {
    errors.push('Achievement count must be a non-negative integer or null.');
  }

  if (!isValidBooleanField(account.primeStatus)) {
    errors.push('Prime status must be true, false, 1, or 0.');
  }

  if (!isValidBooleanField(account.vacStatus)) {
    errors.push('VAC status must be true, false, 1, or 0.');
  }

  if (account.accountCreated != null && !isValidDate(account.accountCreated)) {
    errors.push('Account creation date must be an ISO date string or null.');
  }

  if (account.lastUpdated != null && !isValidDate(account.lastUpdated)) {
    errors.push('Last updated must be an ISO date string.');
  }

  if (account.lastChecked != null && !isValidDate(account.lastChecked)) {
    errors.push('Last checked must be an ISO date string or null.');
  }

  if (account.lastInventoryUpdate != null && !isValidDate(account.lastInventoryUpdate)) {
    errors.push('Last inventory update must be an ISO date string or null.');
  }

  if (account.lastGamePlayed != null && !isValidDate(account.lastGamePlayed)) {
    errors.push('Last game played must be an ISO date string or null.');
  }

  if (account.dateAdded != null && !isValidDate(account.dateAdded)) {
    errors.push('Date added must be an ISO date string.');
  }

  if (account.inventoryPrivacy != null && !INVENTORY_PRIVACY_VALUES.includes(account.inventoryPrivacy)) {
    errors.push(`Inventory privacy must be one of: ${INVENTORY_PRIVACY_VALUES.join(', ')}.`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateAccount,
  isValidSteamId64,
  isValidNonNegativeInteger,
  isValidNonNegativeNumber,
  isValidBooleanField,
  isValidDate,
  sanitizeString,
  INVENTORY_PRIVACY_VALUES
};
