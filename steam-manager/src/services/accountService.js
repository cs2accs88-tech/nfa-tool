const { getDatabase } = require('../database/connection');
const { buildInsertAccountParams } = require('../database/queries/accountQueries');
const { buildAccountPayload } = require('../models/accountModel');

const db = getDatabase();

const createAccountStmt = db.prepare(`
  INSERT INTO accounts (
    steamId64,
    username,
    displayName,
    profileUrl,
    notes,
    tags,
    primeStatus,
    vacStatus,
    gameBanStatus,
    cooldownStatus,
    accountStatus,
    rank,
    level,
    hoursPlayed,
    rating,
    inventoryValue,
    itemCount,
    rareItemCount,
    medalCount,
    medalsList,
    createdAt,
    updatedAt,
    lastCheckedAt
  ) VALUES (
    @steamId64,
    @username,
    @displayName,
    @profileUrl,
    @notes,
    @tags,
    @primeStatus,
    @vacStatus,
    @gameBanStatus,
    @cooldownStatus,
    @accountStatus,
    @rank,
    @level,
    @hoursPlayed,
    @rating,
    @inventoryValue,
    @itemCount,
    @rareItemCount,
    @medalCount,
    @medalsList,
    @createdAt,
    @updatedAt,
    @lastCheckedAt
  )
`);

const getAccountByIdStmt = db.prepare(`SELECT * FROM accounts WHERE id = ?`);
const getAccountBySteamIdStmt = db.prepare(`SELECT * FROM accounts WHERE steamId64 = ?`);

function normalizeAccount(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    primeStatus: Boolean(row.primeStatus),
    vacStatus: Boolean(row.vacStatus),
    gameBanStatus: Boolean(row.gameBanStatus),
    cooldownStatus: Boolean(row.cooldownStatus)
  };
}

function createAccount(raw) {
  try {
    const account = buildAccountPayload(raw);
    const params = buildInsertAccountParams(account);
    const result = createAccountStmt.run(params);
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      validation: error.validation || null
    };
  }
}

function getAccountById(id) {
  try {
    const row = getAccountByIdStmt.get(id);
    return { success: true, account: normalizeAccount(row) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function findAccountBySteamId(steamId64) {
  try {
    const row = getAccountBySteamIdStmt.get(steamId64);
    return { success: true, account: normalizeAccount(row) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getAllAccounts({ page = 1, pageSize = 50, sortBy = 'updatedAt', sortOrder = 'DESC' } = {}) {
  const allowedColumns = new Set(['username', 'rank', 'updatedAt', 'inventoryValue']);
  const column = allowedColumns.has(sortBy) ? sortBy : 'updatedAt';
  const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  try {
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`SELECT * FROM accounts ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`).all(pageSize, offset);
    return { success: true, accounts: rows.map(normalizeAccount) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateAccount(raw) {
  if (!raw.id) {
    return { success: false, error: 'Account id is required for update.' };
  }

  try {
    const account = buildAccountPayload(raw);
    const params = { ...buildInsertAccountParams(account), id: raw.id, updatedAt: new Date().toISOString() };
    const result = db.prepare(`
      UPDATE accounts SET
        steamId64 = @steamId64,
        username = @username,
        displayName = @displayName,
        profileUrl = @profileUrl,
        notes = @notes,
        tags = @tags,
        primeStatus = @primeStatus,
        vacStatus = @vacStatus,
        gameBanStatus = @gameBanStatus,
        cooldownStatus = @cooldownStatus,
        accountStatus = @accountStatus,
        rank = @rank,
        level = @level,
        hoursPlayed = @hoursPlayed,
        rating = @rating,
        inventoryValue = @inventoryValue,
        itemCount = @itemCount,
        rareItemCount = @rareItemCount,
        medalCount = @medalCount,
        medalsList = @medalsList,
        lastCheckedAt = @lastCheckedAt,
        updatedAt = @updatedAt
      WHERE id = @id
    `).run(params);

    return { success: true, changes: result.changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteAccount(id) {
  try {
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return { success: true, changes: result.changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function searchAccounts(query, { page = 1, pageSize = 50 } = {}) {
  try {
    const searchTerm = `%${String(query).trim()}%`;
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT * FROM accounts
      WHERE steamId64 LIKE ? OR username LIKE ? OR displayName LIKE ? OR notes LIKE ? OR tags LIKE ?
        OR steamProfileURL LIKE ? OR customProfileURL LIKE ?
      ORDER BY updatedAt DESC
      LIMIT ? OFFSET ?
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, pageSize, offset);
    return { success: true, accounts: rows.map(normalizeAccount) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function filterAccounts(filters = {}, { page = 1, pageSize = 50 } = {}) {
  const conditions = [];
  const params = [];

  if (filters.primeStatus !== undefined) {
    conditions.push('primeStatus = ?');
    params.push(filters.primeStatus ? 1 : 0);
  }
  if (filters.vacStatus !== undefined) {
    conditions.push('vacStatus = ?');
    params.push(filters.vacStatus ? 1 : 0);
  }
  if (filters.rankMin !== undefined) {
    conditions.push('rank >= ?');
    params.push(filters.rankMin);
  }
  if (filters.rankMax !== undefined) {
    conditions.push('rank <= ?');
    params.push(filters.rankMax);
  }
  if (filters.username) {
    conditions.push('username LIKE ?');
    params.push(`%${String(filters.username).trim()}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  try {
    const rows = db.prepare(`SELECT * FROM accounts ${whereClause} ORDER BY updatedAt DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    return { success: true, accounts: rows.map(normalizeAccount) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function sortAccounts(sortBy = 'updatedAt', sortOrder = 'DESC', { page = 1, pageSize = 50 } = {}) {
  const allowedColumns = new Set(['username', 'rank', 'updatedAt', 'inventoryValue']);
  const column = allowedColumns.has(sortBy) ? sortBy : 'updatedAt';
  const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const offset = (page - 1) * pageSize;

  try {
    const rows = db.prepare(`SELECT * FROM accounts ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`).all(pageSize, offset);
    return { success: true, accounts: rows.map(normalizeAccount) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createAccount,
  getAllAccounts,
  getAccountById,
  findAccountBySteamId,
  updateAccount,
  deleteAccount,
  searchAccounts,
  filterAccounts,
  sortAccounts
};
