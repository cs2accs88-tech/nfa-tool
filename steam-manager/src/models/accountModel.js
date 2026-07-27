const { validateAccountData } = require('../utils/validator');

function buildAccountPayload(raw) {
  const account = {
    steamId64: raw.steamId64,
    username: raw.username,
    displayName: raw.displayName || null,
    profileUrl: raw.profileUrl || null,
    notes: raw.notes || null,
    tags: raw.tags || null,
    primeStatus: raw.primeStatus || false,
    vacStatus: raw.vacStatus || false,
    gameBanStatus: raw.gameBanStatus || false,
    cooldownStatus: raw.cooldownStatus || false,
    accountStatus: raw.accountStatus || null,
    rank: raw.rank || null,
    level: raw.level || null,
    hoursPlayed: raw.hoursPlayed || null,
    rating: raw.rating || null,
    inventoryValue: raw.inventoryValue || 0,
    itemCount: raw.itemCount || 0,
    rareItemCount: raw.rareItemCount || 0,
    medalCount: raw.medalCount || 0,
    medalsList: raw.medalsList || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    lastCheckedAt: raw.lastCheckedAt || null
  };

  const validation = validateAccountData(account);
  if (!validation.valid) {
    const error = new Error('Invalid account data: ' + validation.errors.join('; '));
    error.validation = validation;
    throw error;
  }

  return account;
}

module.exports = {
  buildAccountPayload
};
