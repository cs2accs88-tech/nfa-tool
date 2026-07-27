const { getDatabase } = require('../database/database');
const { validateAccount } = require('../utils/validator');

const db = getDatabase();

const SORT_COLUMNS = new Set([
  'username',
  'competitiveRank',
  'inventoryValue',
  'lastChecked',
  'dateAdded',
  'lastUpdated'
]);

function safeSortColumn(column) {
  if (!column) {
    return 'lastUpdated';
  }
  return SORT_COLUMNS.has(column) ? column : 'lastUpdated';
}

function safeSortOrder(order) {
  const normalized = String(order || 'DESC').toUpperCase();
  return normalized === 'ASC' ? 'ASC' : 'DESC';
}

function parseTags(tags) {
  if (Array.isArray(tags)) {
    return tags.filter(Boolean).map((tag) => String(tag).trim()).filter((tag) => tag.length > 0);
  }

  if (typeof tags === 'string') {
    return tags
      .split(/[,;]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
}

function serializeTags(tags) {
  const normalized = parseTags(tags);
  return normalized.length > 0 ? normalized.join(', ') : null;
}

function parseJsonField(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeJsonField(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed);
      }
    } catch {
      return JSON.stringify([{ note: value, createdAt: new Date().toISOString() }]);
    }
  }

  return JSON.stringify([]);
}

function normalizeBoolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'yes') {
    return 1;
  }

  return 0;
}

function normalizeAccountRow(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    primeStatus: row.primeStatus === 1,
    vacStatus: row.vacStatus === 1,
    gameBanStatus: row.gameBanStatus === 1,
    tradeRestrictionStatus: row.tradeRestrictionStatus === 1,
    communityBanStatus: row.communityBanStatus === 1,
    cooldownStatus: row.cooldownStatus === 1,
    verificationStatus: row.verificationStatus === 1,
    inventoryValue: row.inventoryValue != null ? Number(row.inventoryValue) : 0,
    inventoryItems: row.inventoryItems != null ? Number(row.inventoryItems) : 0,
    rareItems: row.rareItems != null ? Number(row.rareItems) : 0,
    serviceMedals: row.serviceMedals != null ? Number(row.serviceMedals) : 0,
    achievementCount: row.achievementCount != null ? Number(row.achievementCount) : 0,
    tags: parseTags(row.tags),
    changesLog: parseJsonField(row.changesLog)
  };
}

function createAccountParams(account) {
  const now = new Date().toISOString();
  const notes = typeof account.notes === 'string' ? account.notes.trim() : account.notes;
  const tags = serializeTags(account.tags);

  return {
    steamId64: account.steamId64,
    username: account.username,
    displayName: account.displayName || null,
    profileUrl: account.profileUrl || null,
    accountCreated: account.accountCreated || null,
    country: account.country || null,
    notes: notes || null,

    competitiveRank: account.competitiveRank === null ? null : Number(account.competitiveRank),
    premierRating: account.premierRating === null ? null : Number(account.premierRating),
    level: account.level === null ? null : Number(account.level),
    xp: account.xp === null ? null : Number(account.xp),
    hoursPlayed: account.hoursPlayed === null ? null : Number(account.hoursPlayed),
    lastGamePlayed: account.lastGamePlayed || null,

    primeStatus: normalizeBoolean(account.primeStatus),
    vacStatus: normalizeBoolean(account.vacStatus),
    gameBanStatus: normalizeBoolean(account.gameBanStatus),
    tradeRestrictionStatus: normalizeBoolean(account.tradeRestrictionStatus),
    communityBanStatus: normalizeBoolean(account.communityBanStatus),
    cooldownStatus: normalizeBoolean(account.cooldownStatus),
    verificationStatus: normalizeBoolean(account.verificationStatus),

    inventoryValue: account.inventoryValue === null ? 0 : Number(account.inventoryValue) || 0,
    inventoryItems: account.inventoryItems === null ? 0 : Number(account.inventoryItems) || 0,
    rareItems: account.rareItems === null ? 0 : Number(account.rareItems) || 0,
    inventoryPrivacy: account.inventoryPrivacy || 'public',
    lastInventoryUpdate: account.lastInventoryUpdate || null,

    serviceMedals: account.serviceMedals === null ? 0 : Number(account.serviceMedals) || 0,
    medalList: account.medalList || null,
    achievementCount: account.achievementCount === null ? 0 : Number(account.achievementCount) || 0,
    specialBadges: account.specialBadges || null,

    dateAdded: account.dateAdded || now,
    lastUpdated: now,
    lastChecked: account.lastChecked || null,
    checkHistory: account.checkHistory || null,
    changesLog: serializeJsonField(account.changesLog || []),
    tags
  };
}

const createAccountStmt = db.prepare(`
  INSERT INTO accounts (
    steamId64,
    username,
    displayName,
    profileUrl,
    accountCreated,
    country,
    notes,

    competitiveRank,
    premierRating,
    level,
    xp,
    hoursPlayed,
    lastGamePlayed,

    primeStatus,
    vacStatus,
    gameBanStatus,
    tradeRestrictionStatus,
    communityBanStatus,
    cooldownStatus,
    verificationStatus,

    inventoryValue,
    inventoryItems,
    rareItems,
    inventoryPrivacy,
    lastInventoryUpdate,

    serviceMedals,
    medalList,
    achievementCount,
    specialBadges,

    dateAdded,
    lastUpdated,
    lastChecked,
    checkHistory,
    changesLog,
    tags
  ) VALUES (
    @steamId64,
    @username,
    @displayName,
    @profileUrl,
    @accountCreated,
    @country,
    @notes,

    @competitiveRank,
    @premierRating,
    @level,
    @xp,
    @hoursPlayed,
    @lastGamePlayed,

    @primeStatus,
    @vacStatus,
    @gameBanStatus,
    @tradeRestrictionStatus,
    @communityBanStatus,
    @cooldownStatus,
    @verificationStatus,

    @inventoryValue,
    @inventoryItems,
    @rareItems,
    @inventoryPrivacy,
    @lastInventoryUpdate,

    @serviceMedals,
    @medalList,
    @achievementCount,
    @specialBadges,

    @dateAdded,
    @lastUpdated,
    @lastChecked,
    @checkHistory,
    @changesLog,
    @tags
  )
`);

const getAccountByIdStmt = db.prepare(`
  SELECT * FROM accounts WHERE id = ?
`);

const getAccountBySteamIdStmt = db.prepare(`
  SELECT * FROM accounts WHERE steamId64 = ?
`);

const updateAccountStmt = db.prepare(`
  UPDATE accounts SET
    steamId64 = @steamId64,
    username = @username,
    displayName = @displayName,
    profileUrl = @profileUrl,
    accountCreated = @accountCreated,
    country = @country,
    notes = @notes,

    competitiveRank = @competitiveRank,
    premierRating = @premierRating,
    level = @level,
    xp = @xp,
    hoursPlayed = @hoursPlayed,
    lastGamePlayed = @lastGamePlayed,

    primeStatus = @primeStatus,
    vacStatus = @vacStatus,
    gameBanStatus = @gameBanStatus,
    tradeRestrictionStatus = @tradeRestrictionStatus,
    communityBanStatus = @communityBanStatus,
    cooldownStatus = @cooldownStatus,
    verificationStatus = @verificationStatus,

    inventoryValue = @inventoryValue,
    inventoryItems = @inventoryItems,
    rareItems = @rareItems,
    inventoryPrivacy = @inventoryPrivacy,
    lastInventoryUpdate = @lastInventoryUpdate,

    serviceMedals = @serviceMedals,
    medalList = @medalList,
    achievementCount = @achievementCount,
    specialBadges = @specialBadges,

    lastChecked = @lastChecked,
    checkHistory = @checkHistory,
    changesLog = @changesLog,
    tags = @tags,
    lastUpdated = @lastUpdated
  WHERE id = @id
`);

const deleteAccountStmt = db.prepare(`
  DELETE FROM accounts WHERE id = ?
`);

function buildFilterConditions(filters, params) {
  const conditions = [];

  if (filters.primeStatus === true) {
    conditions.push('primeStatus = 1');
  }
  if (filters.primeStatus === false) {
    conditions.push('primeStatus = 0');
  }

  if (filters.vacStatus === true) {
    conditions.push('vacStatus = 1');
  }
  if (filters.vacStatus === false) {
    conditions.push('vacStatus = 0');
  }

  if (filters.cooldownStatus === true) {
    conditions.push('cooldownStatus = 1');
  }
  if (filters.cooldownStatus === false) {
    conditions.push('cooldownStatus = 0');
  }

  if (typeof filters.rankMin === 'number') {
    conditions.push('competitiveRank >= @rankMin');
    params.rankMin = filters.rankMin;
  }

  if (typeof filters.rankMax === 'number') {
    conditions.push('competitiveRank <= @rankMax');
    params.rankMax = filters.rankMax;
  }

  if (typeof filters.levelMin === 'number') {
    conditions.push('level >= @levelMin');
    params.levelMin = filters.levelMin;
  }

  if (typeof filters.levelMax === 'number') {
    conditions.push('level <= @levelMax');
    params.levelMax = filters.levelMax;
  }

  if (typeof filters.hoursPlayedMin === 'number') {
    conditions.push('hoursPlayed >= @hoursPlayedMin');
    params.hoursPlayedMin = filters.hoursPlayedMin;
  }

  if (typeof filters.hoursPlayedMax === 'number') {
    conditions.push('hoursPlayed <= @hoursPlayedMax');
    params.hoursPlayedMax = filters.hoursPlayedMax;
  }

  if (typeof filters.inventoryMin === 'number') {
    conditions.push('inventoryValue >= @inventoryMin');
    params.inventoryMin = filters.inventoryMin;
  }

  if (typeof filters.inventoryMax === 'number') {
    conditions.push('inventoryValue <= @inventoryMax');
    params.inventoryMax = filters.inventoryMax;
  }

  if (typeof filters.rareItemsMin === 'number') {
    conditions.push('rareItems >= @rareItemsMin');
    params.rareItemsMin = filters.rareItemsMin;
  }

  if (filters.recentlyCheckedDays) {
    conditions.push('lastChecked >= @recentlyCheckedDate');
    params.recentlyCheckedDate = new Date(Date.now() - filters.recentlyCheckedDays * 24 * 60 * 60 * 1000).toISOString();
  }

  if (filters.neverChecked) {
    conditions.push('lastChecked IS NULL');
  }

  if (filters.recentlyAddedDays) {
    conditions.push('dateAdded >= @recentlyAddedDate');
    params.recentlyAddedDate = new Date(Date.now() - filters.recentlyAddedDays * 24 * 60 * 60 * 1000).toISOString();
  }

  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    const tagConditions = filters.tags.map((tag, index) => {
      const key = `tag${index}`;
      params[key] = `%${tag}%`;
      return `tags LIKE @${key}`;
    });
    conditions.push(`(${tagConditions.join(' OR ')})`);
  }

  return conditions;
}

function buildSearchCondition(search, params) {
  if (!search || !String(search).trim()) {
    return null;
  }

  params.search = `%${String(search).trim()}%`;
  return `(
    steamId64 LIKE @search OR
    username LIKE @search OR
    displayName LIKE @search OR
    notes LIKE @search OR
    tags LIKE @search
  )`;
}

function buildQuery({ search, filters, sortBy, sortOrder, page, pageSize }) {
  const params = {};
  const conditions = [];
  const searchCondition = buildSearchCondition(search, params);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  conditions.push(...buildFilterConditions(filters || {}, params));

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderColumn = safeSortColumn(sortBy);
  const orderDirection = safeSortOrder(sortOrder);
  const offset = Number(page > 1 ? (page - 1) * pageSize : 0);
  const limit = Number(pageSize || 50);

  const sql = `SELECT * FROM accounts ${whereClause} ORDER BY ${orderColumn} ${orderDirection} LIMIT @limit OFFSET @offset`;
  params.limit = limit;
  params.offset = offset;

  return { sql, params };
}

function queryAccounts(options = {}) {
  const { sql, params } = buildQuery(options);
  try {
    const rows = db.prepare(sql).all(params);
    return { success: true, accounts: rows.map(normalizeAccountRow) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getAllAccounts(options = {}) {
  return queryAccounts(options);
}

function getAccountById(id) {
  try {
    const row = getAccountByIdStmt.get(id);
    return { success: true, account: normalizeAccountRow(row) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getAccountBySteamId(steamId64) {
  try {
    const row = getAccountBySteamIdStmt.get(steamId64);
    return { success: true, account: normalizeAccountRow(row) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function createAccount(account) {
  const validation = validateAccount(account);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; '), errors: validation.errors };
  }

  const existing = getAccountBySteamId(account.steamId64);
  if (existing.success && existing.account) {
    return { success: false, error: 'Steam ID already exists.' };
  }

  try {
    const result = createAccountStmt.run(createAccountParams(account));
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateAccount(account) {
  if (!account.id) {
    return { success: false, error: 'Account id is required for update.' };
  }

  const validation = validateAccount(account);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; '), errors: validation.errors };
  }

  try {
    const result = updateAccountStmt.run({ ...createAccountParams(account), id: account.id, lastUpdated: new Date().toISOString() });
    return { success: true, changes: result.changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteAccount(id) {
  try {
    const result = deleteAccountStmt.run(id);
    return { success: true, changes: result.changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function searchAccounts(query, options = {}) {
  return queryAccounts({ ...options, search: query });
}

function filterAccounts(filters = {}, options = {}) {
  return queryAccounts({ ...options, filters });
}

function sortAccounts(sortBy, sortOrder = 'DESC', options = {}) {
  return queryAccounts({ ...options, sortBy, sortOrder });
}

function addAccountNote(accountId, noteText) {
  if (!noteText || String(noteText).trim().length === 0) {
    return { success: false, error: 'Note text cannot be empty.' };
  }

  const accountResult = getAccountById(accountId);
  if (!accountResult.success || !accountResult.account) {
    return { success: false, error: 'Account not found.' };
  }

  const currentLog = accountResult.account.changesLog || [];
  currentLog.push({
    createdAt: new Date().toISOString(),
    note: String(noteText).trim()
  });

  const updateResult = updateAccount({
    ...accountResult.account,
    notes: noteText,
    changesLog: currentLog,
    id: accountId
  });

  return updateResult;
}

function bulkDeleteAccounts(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'No account ids provided.' };
  }

  const placeholders = ids.map(() => '?').join(', ');
  const sql = `DELETE FROM accounts WHERE id IN (${placeholders})`;

  try {
    const result = db.prepare(sql).run(...ids);
    return { success: true, changes: result.changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function bulkTagAccounts(ids, tags, mode = 'add') {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'No account ids provided.' };
  }

  const normalizedTags = parseTags(tags);
  if (normalizedTags.length === 0) {
    return { success: false, error: 'No tags provided.' };
  }

  try {
    const stmt = db.prepare('SELECT id, tags FROM accounts WHERE id IN (' + ids.map(() => '?').join(', ') + ')');
    const rows = stmt.all(...ids);
    const updateStmt = db.prepare(`UPDATE accounts SET tags = ? WHERE id = ?`);

    for (const row of rows) {
      const existingTags = parseTags(row.tags);
      const finalTags = mode === 'replace' ? normalizedTags : Array.from(new Set([...existingTags, ...normalizedTags]));
      updateStmt.run(finalTags.join(', '), row.id);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  getAllAccounts,
  getAccountById,
  getAccountBySteamId,
  createAccount,
  updateAccount,
  deleteAccount,
  searchAccounts,
  filterAccounts,
  sortAccounts,
  addAccountNote,
  bulkDeleteAccounts,
  bulkTagAccounts
};
