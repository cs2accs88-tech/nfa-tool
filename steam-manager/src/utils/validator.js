const STEAM_ID64_REGEX = /^\d{17}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isValidSteamId64(value) {
  return typeof value === 'string' && STEAM_ID64_REGEX.test(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidDateString(value) {
  return value === null || value === undefined || (typeof value === 'string' && ISO_DATE_REGEX.test(value));
}

function validateAccountData(account) {
  const errors = [];

  if (!isValidSteamId64(account.steamId64)) {
    errors.push('SteamID64 must be a 17-digit numeric string.');
  }
  if (!account.username || typeof account.username !== 'string') {
    errors.push('Username is required.');
  }
  if (account.rank !== null && account.rank !== undefined && !isNonNegativeInteger(account.rank)) {
    errors.push('Rank must be a non-negative integer or null.');
  }
  if (account.level !== null && account.level !== undefined && !isNonNegativeInteger(account.level)) {
    errors.push('Level must be a non-negative integer or null.');
  }
  if (account.hoursPlayed !== null && account.hoursPlayed !== undefined && !isNonNegativeNumber(account.hoursPlayed)) {
    errors.push('Hours played must be a valid number or null.');
  }
  if (account.inventoryValue !== null && account.inventoryValue !== undefined && !isNonNegativeNumber(account.inventoryValue)) {
    errors.push('Inventory value must be a non-negative number.');
  }
  if (account.itemCount !== null && account.itemCount !== undefined && !isNonNegativeInteger(account.itemCount)) {
    errors.push('Item count must be a non-negative integer.');
  }
  if (account.rareItemCount !== null && account.rareItemCount !== undefined && !isNonNegativeInteger(account.rareItemCount)) {
    errors.push('Rare item count must be a non-negative integer.');
  }
  if (account.medalCount !== null && account.medalCount !== undefined && !isNonNegativeInteger(account.medalCount)) {
    errors.push('Medal count must be a non-negative integer.');
  }
  if (!isValidDateString(account.createdAt)) {
    errors.push('Created date must be an ISO date string.');
  }
  if (!isValidDateString(account.updatedAt)) {
    errors.push('Updated date must be an ISO date string.');
  }
  if (!isValidDateString(account.lastCheckedAt)) {
    errors.push('Last checked date must be an ISO date string or null.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateAccountData,
  isValidSteamId64,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isValidDateString
};
