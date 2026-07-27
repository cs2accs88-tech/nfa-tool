/**
 * Account model shape and default values used throughout the app.
 */

const Account = {
  id: null,
  steamId64: '',
  username: '',
  displayName: '',
  profileUrl: '',
  accountCreated: null,
  country: null,
  notes: null,

  competitiveRank: null,
  premierRating: null,
  level: null,
  xp: null,
  hoursPlayed: null,
  lastGamePlayed: null,

  primeStatus: false,
  vacStatus: false,
  gameBanStatus: false,
  tradeRestrictionStatus: false,
  communityBanStatus: false,
  cooldownStatus: false,
  verificationStatus: false,

  inventoryValue: 0,
  inventoryItems: 0,
  rareItems: 0,
  inventoryPrivacy: 'public',
  lastInventoryUpdate: null,

  serviceMedals: 0,
  medalList: null,
  achievementCount: 0,
  specialBadges: null,

  dateAdded: null,
  lastUpdated: null,
  lastChecked: null,
  checkHistory: null,
  changesLog: null,
  tags: null
};

function createFromPayload(payload) {
  const now = new Date().toISOString();

  return {
    ...Account,
    steamId64: payload.steamId64 || '',
    username: payload.username || '',
    displayName: payload.displayName || null,
    profileUrl: payload.profileUrl || null,
    accountCreated: payload.accountCreated || null,
    country: payload.country || null,
    notes: payload.notes || null,

    competitiveRank: payload.competitiveRank ?? null,
    premierRating: payload.premierRating ?? null,
    level: payload.level ?? null,
    xp: payload.xp ?? null,
    hoursPlayed: payload.hoursPlayed ?? null,
    lastGamePlayed: payload.lastGamePlayed || null,

    primeStatus: payload.primeStatus ? true : false,
    vacStatus: payload.vacStatus ? true : false,
    gameBanStatus: payload.gameBanStatus ? true : false,
    tradeRestrictionStatus: payload.tradeRestrictionStatus ? true : false,
    communityBanStatus: payload.communityBanStatus ? true : false,
    cooldownStatus: payload.cooldownStatus ? true : false,
    verificationStatus: payload.verificationStatus ? true : false,

    inventoryValue: payload.inventoryValue ?? 0,
    inventoryItems: payload.inventoryItems ?? 0,
    rareItems: payload.rareItems ?? 0,
    inventoryPrivacy: payload.inventoryPrivacy || 'public',
    lastInventoryUpdate: payload.lastInventoryUpdate || null,

    serviceMedals: payload.serviceMedals ?? 0,
    medalList: payload.medalList || null,
    achievementCount: payload.achievementCount ?? 0,
    specialBadges: payload.specialBadges || null,

    dateAdded: payload.dateAdded || now,
    lastUpdated: payload.lastUpdated || now,
    lastChecked: payload.lastChecked || null,
    checkHistory: payload.checkHistory || null,
    changesLog: payload.changesLog || null,
    tags: payload.tags || null
  };
}

module.exports = {
  Account,
  createFromPayload
};
