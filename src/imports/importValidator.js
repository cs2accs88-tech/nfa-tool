const { validateAccount, sanitizeString } = require('../utils/validator');

const FIELD_ALIASES = {
  steamId64: ['steamid64', 'steamid', 'steam_id', 'steam id', 'id'],
  username: ['username', 'user', 'name', 'nickname', 'alias'],
  displayName: ['displayname', 'display_name', 'display name', 'persona', 'persona name'],
  profileUrl: ['profileurl', 'profile_url', 'profile url', 'url'],
  accountCreated: ['accountcreated', 'created', 'createdat', 'creationdate', 'account created'],
  country: ['country', 'region', 'location'],
  notes: ['notes', 'note', 'comment', 'comments'],
  competitiveRank: ['rank', 'competitiverank', 'competitive rank', 'skillrank'],
  premierRating: ['premierrating', 'premier rating'],
  level: ['level', 'playerlevel'],
  xp: ['xp', 'experience', 'exp'],
  hoursPlayed: ['hoursplayed', 'hours played', 'playtime'],
  lastGamePlayed: ['lastgameplayed', 'last game played', 'recentgame'],
  primeStatus: ['primestatus', 'prime status', 'prime'],
  vacStatus: ['vacstatus', 'vac status', 'vac'],
  gameBanStatus: ['gamebanstatus', 'game ban status', 'gameban'],
  tradeRestrictionStatus: ['traderestrictionstatus', 'trade restriction status', 'trade restriction'],
  communityBanStatus: ['communitybanstatus', 'community ban status', 'communityban'],
  cooldownStatus: ['cooldownstatus', 'cooldown status', 'cooldown'],
  verificationStatus: ['verificationstatus', 'verification status', 'verified'],
  inventoryValue: ['inventoryvalue', 'inventory value', 'value'],
  inventoryItems: ['inventoryitems', 'inventory items', 'items'],
  rareItems: ['rareitems', 'rare items', 'rare item count', 'rare count'],
  inventoryPrivacy: ['inventoryprivacy', 'privacy', 'inventory privacy'],
  lastInventoryUpdate: ['lastinventoryupdate', 'inventoryupdated', 'inventory update'],
  serviceMedals: ['servicemedals', 'service medals', 'medals', 'medalcount'],
  medalList: ['medallist', 'medal list'],
  achievementCount: ['achievementcount', 'achievement count', 'achievements'],
  specialBadges: ['specialbadges', 'special badges', 'badges'],
  dateAdded: ['dateadded', 'added', 'addeddate'],
  lastUpdated: ['lastupdated', 'updated', 'modified', 'last modified'],
  lastChecked: ['lastchecked', 'checked', 'last checked'],
  checkHistory: ['checkhistory', 'check history', 'history'],
  changesLog: ['changeslog', 'changes log'],
  tags: ['tags', 'tag', 'labels']
};

function normalizeKeys(rawRecord) {
  return Object.entries(rawRecord).reduce((result, [key, value]) => {
    if (typeof key !== 'string') {
      return result;
    }

    result[key.toLowerCase().trim()] = value;
    return result;
  }, {});
}

function findValue(normalizedRecord, aliases) {
  return aliases.reduce((found, alias) => {
    if (found !== undefined && found !== null) {
      return found;
    }
    return normalizedRecord[alias];
  }, null);
}

function parseBoolean(value) {
  if (value === true || value === 1 || value === '1') {
    return true;
  }

  if (value === false || value === 0 || value === '0') {
    return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['yes', 'true', 'y', 't', 'prime', 'clean'].includes(normalized)) {
      return true;
    }
    if (['no', 'false', 'n', 'f', 'banned', 'not prime', 'unclean'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function parseNumber(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  if (options.integer) {
    return Math.trunc(parsed);
  }

  return parsed;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function buildAccountRecord(rawRecord) {
  const normalized = normalizeKeys(rawRecord);

  const competitiveRankValue = findValue(normalized, FIELD_ALIASES.competitiveRank);
  const primeStatusValue = findValue(normalized, FIELD_ALIASES.primeStatus);
  const vacStatusValue = findValue(normalized, FIELD_ALIASES.vacStatus);
  const cooldownValue = findValue(normalized, FIELD_ALIASES.cooldownStatus);

  const mapped = {
    steamId64: sanitizeString(findValue(normalized, FIELD_ALIASES.steamId64)),
    username: sanitizeString(findValue(normalized, FIELD_ALIASES.username)),
    displayName: sanitizeString(findValue(normalized, FIELD_ALIASES.displayName)),
    profileUrl: sanitizeString(findValue(normalized, FIELD_ALIASES.profileUrl)),
    accountCreated: parseDate(findValue(normalized, FIELD_ALIASES.accountCreated)),
    country: sanitizeString(findValue(normalized, FIELD_ALIASES.country)),
    notes: sanitizeString(findValue(normalized, FIELD_ALIASES.notes)),
    competitiveRank: parseNumber(competitiveRankValue, { integer: true }),
    premierRating: parseNumber(findValue(normalized, FIELD_ALIASES.premierRating), { integer: true }),
    level: parseNumber(findValue(normalized, FIELD_ALIASES.level), { integer: true }),
    xp: parseNumber(findValue(normalized, FIELD_ALIASES.xp)),
    hoursPlayed: parseNumber(findValue(normalized, FIELD_ALIASES.hoursPlayed)),
    lastGamePlayed: parseDate(findValue(normalized, FIELD_ALIASES.lastGamePlayed)),
    primeStatus: parseBoolean(primeStatusValue),
    vacStatus: parseBoolean(vacStatusValue),
    gameBanStatus: parseBoolean(findValue(normalized, FIELD_ALIASES.gameBanStatus)),
    tradeRestrictionStatus: parseBoolean(findValue(normalized, FIELD_ALIASES.tradeRestrictionStatus)),
    communityBanStatus: parseBoolean(findValue(normalized, FIELD_ALIASES.communityBanStatus)),
    cooldownStatus: parseBoolean(cooldownValue),
    verificationStatus: parseBoolean(findValue(normalized, FIELD_ALIASES.verificationStatus)),
    inventoryValue: parseNumber(findValue(normalized, FIELD_ALIASES.inventoryValue)),
    inventoryItems: parseNumber(findValue(normalized, FIELD_ALIASES.inventoryItems), { integer: true }),
    rareItems: parseNumber(findValue(normalized, FIELD_ALIASES.rareItems), { integer: true }),
    inventoryPrivacy: sanitizeString(findValue(normalized, FIELD_ALIASES.inventoryPrivacy)) || 'public',
    lastInventoryUpdate: parseDate(findValue(normalized, FIELD_ALIASES.lastInventoryUpdate)),
    serviceMedals: parseNumber(findValue(normalized, FIELD_ALIASES.serviceMedals), { integer: true }),
    medalList: sanitizeString(findValue(normalized, FIELD_ALIASES.medalList)),
    achievementCount: parseNumber(findValue(normalized, FIELD_ALIASES.achievementCount), { integer: true }),
    specialBadges: sanitizeString(findValue(normalized, FIELD_ALIASES.specialBadges)),
    dateAdded: parseDate(findValue(normalized, FIELD_ALIASES.dateAdded)),
    lastUpdated: parseDate(findValue(normalized, FIELD_ALIASES.lastUpdated)),
    lastChecked: parseDate(findValue(normalized, FIELD_ALIASES.lastChecked)),
    checkHistory: sanitizeString(findValue(normalized, FIELD_ALIASES.checkHistory)),
    changesLog: sanitizeString(findValue(normalized, FIELD_ALIASES.changesLog)),
    tags: sanitizeString(findValue(normalized, FIELD_ALIASES.tags))
  };

  const rankValue = sanitizeString(competitiveRankValue);
  if (rankValue && mapped.competitiveRank === null && rankValue.length > 0) {
    mapped.notes = mapped.notes ? `${mapped.notes} | Rank: ${rankValue}` : `Rank: ${rankValue}`;
  }

  return mapped;
}

function validateImportRecord(rawRecord, index) {
  const account = buildAccountRecord(rawRecord);
  const validation = validateAccount(account);

  return {
    index,
    rawRecord,
    account,
    valid: validation.valid,
    errors: validation.errors
  };
}

module.exports = {
  FIELD_ALIASES,
  buildAccountRecord,
  validateImportRecord,
  parseBoolean,
  parseNumber,
  parseDate
};
