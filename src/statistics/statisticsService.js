const { getDatabase } = require('../database/database');
const { normalizeNumber, formatCurrency, createDistributionBuckets, buildChartData } = require('./statisticsCalculator');
const { getCache, setCache, clearCache } = require('./statisticsCache');

const db = getDatabase();

const STATUSES = {
  prime: { field: 'primeStatus' },
  vac: { field: 'vacStatus' },
  cooldown: { field: 'cooldownStatus' }
};

function ensureDate(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function buildFilterClause(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.startDate) {
    conditions.push('dateAdded >= @startDate');
    params.startDate = ensureDate(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('dateAdded <= @endDate');
    params.endDate = ensureDate(filters.endDate);
  }

  if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
    const tagConditions = filters.tags.map((tag, index) => {
      const key = `tag${index}`;
      params[key] = `%${String(tag).trim()}%`;
      return `tags LIKE @${key}`;
    });
    conditions.push(`(${tagConditions.join(' OR ')})`);
  }

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

  if (typeof filters.inventoryMin === 'number') {
    conditions.push('inventoryValue >= @inventoryMin');
    params.inventoryMin = filters.inventoryMin;
  }
  if (typeof filters.inventoryMax === 'number') {
    conditions.push('inventoryValue <= @inventoryMax');
    params.inventoryMax = filters.inventoryMax;
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

function querySingleAggregate(sql, params = {}) {
  try {
    return db.prepare(sql).get(params) || {};
  } catch (error) {
    throw new Error(error.message || 'Database query failed');
  }
}

function getTotalAccounts(filters = {}) {
  const cacheKey = { type: 'total', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { where, params } = buildFilterClause(filters);
  const row = querySingleAggregate(`SELECT COUNT(*) AS total FROM accounts ${where}`, params);
  const result = {
    totalAccounts: row.total || 0,
    activeAccounts: querySingleAggregate(`SELECT COUNT(*) AS active FROM accounts ${where} AND lastChecked >= @activeDate`, { ...params, activeDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }).active || 0,
    recentlyAdded: querySingleAggregate(`SELECT COUNT(*) AS recentAdded FROM accounts ${where} AND dateAdded >= @recentAddedDate`, { ...params, recentAddedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }).recentAdded || 0,
    recentlyUpdated: querySingleAggregate(`SELECT COUNT(*) AS recentUpdated FROM accounts ${where} AND lastUpdated >= @recentUpdatedDate`, { ...params, recentUpdatedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }).recentUpdated || 0,
    accountsWithMissingInfo: querySingleAggregate(`SELECT COUNT(*) AS missingInfo FROM accounts ${where} AND (
      displayName IS NULL OR profileUrl IS NULL OR country IS NULL OR notes IS NULL
    )`, params).missingInfo || 0
  };

  setCache(cacheKey, result);
  return result;
}

function getAccountStatusStats(filters = {}) {
  const cacheKey = { type: 'status', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { where, params } = buildFilterClause(filters);
  const row = querySingleAggregate(`
    SELECT
      SUM(primeStatus) AS primeCount,
      COUNT(*) - SUM(primeStatus) AS nonPrimeCount,
      SUM(CASE WHEN vacStatus = 0 THEN 1 ELSE 0 END) AS vacCleanCount,
      SUM(CASE WHEN vacStatus = 1 THEN 1 ELSE 0 END) AS vacBannedCount,
      SUM(cooldownStatus) AS cooldownCount
    FROM accounts
    ${where}
  `, params);

  const result = {
    primeAccounts: row.primeCount || 0,
    nonPrimeAccounts: row.nonPrimeCount || 0,
    vacCleanAccounts: row.vacCleanCount || 0,
    vacBannedAccounts: row.vacBannedCount || 0,
    cooldownAccounts: row.cooldownCount || 0
  };

  setCache(cacheKey, result);
  return result;
}

function getRankStats(filters = {}) {
  const cacheKey = { type: 'rank', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { where, params } = buildFilterClause(filters);
  const row = querySingleAggregate(`
    SELECT
      AVG(competitiveRank) AS averageRank,
      MAX(competitiveRank) AS highestRank,
      MIN(competitiveRank) AS lowestRank,
      AVG(level) AS averageLevel,
      AVG(hoursPlayed) AS averageHoursPlayed
    FROM accounts
    ${where}
  `, params);

  const distributionRows = db.prepare(`
    SELECT competitiveRank AS value, COUNT(*) AS count
    FROM accounts
    ${where}
    GROUP BY competitiveRank
    ORDER BY competitiveRank ASC
    LIMIT 12
  `).all(params);

  const result = {
    averageRank: Number(row.averageRank?.toFixed(2) || 0),
    highestRank: row.highestRank || 0,
    lowestRank: row.lowestRank || 0,
    averageLevel: Number(row.averageLevel?.toFixed(2) || 0),
    averageHoursPlayed: Number(row.averageHoursPlayed?.toFixed(2) || 0),
    rankDistribution: buildChartData(distributionRows, 'count', 'value')
  };

  setCache(cacheKey, result);
  return result;
}

function getInventoryStats(filters = {}) {
  const cacheKey = { type: 'inventory', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { where, params } = buildFilterClause(filters);
  const row = querySingleAggregate(`
    SELECT
      SUM(inventoryValue) AS totalInventoryValue,
      AVG(inventoryValue) AS averageInventoryValue,
      MAX(inventoryValue) AS highestInventoryValue,
      SUM(CASE WHEN rareItems > 0 THEN 1 ELSE 0 END) AS accountsWithRareItems,
      SUM(rareItems) AS totalRareItems
    FROM accounts
    ${where}
  `, params);

  const bucketRows = db.prepare(`
    SELECT
      CASE
        WHEN inventoryValue <= 50 THEN '0-50'
        WHEN inventoryValue <= 150 THEN '51-150'
        WHEN inventoryValue <= 500 THEN '151-500'
        WHEN inventoryValue <= 1000 THEN '501-1000'
        ELSE '1000+'
      END AS label,
      COUNT(*) AS value
    FROM accounts
    ${where}
    GROUP BY label
    ORDER BY MIN(inventoryValue) ASC
  `).all(params);

  const result = {
    totalInventoryValue: normalizeNumber(row.totalInventoryValue),
    averageInventoryValue: normalizeNumber(row.averageInventoryValue),
    highestInventoryValue: normalizeNumber(row.highestInventoryValue),
    accountsWithRareItems: row.accountsWithRareItems || 0,
    totalRareItems: row.totalRareItems || 0,
    inventoryDistribution: buildChartData(bucketRows)
  };

  setCache(cacheKey, result);
  return result;
}

function buildActivityFilterClause(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.startDate) {
    conditions.push('createdAt >= @startDate');
    params.startDate = ensureDate(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('createdAt <= @endDate');
    params.endDate = ensureDate(filters.endDate);
  }

  if (filters.accountName) {
    conditions.push('accountName LIKE @accountName');
    params.accountName = `%${String(filters.accountName).trim()}%`;
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

function getRecentActivity(filters = {}) {
  const cacheKey = { type: 'activity', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { where, params } = buildActivityFilterClause(filters);
  const query = `
    SELECT id, accountId, accountName, action, details, createdAt
    FROM activity_logs
    ${where}
    ORDER BY createdAt DESC
    LIMIT @limit
  `;

  const rows = db.prepare(query).all({ ...params, limit: filters.limit || 25 });
  const result = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountName,
    action: row.action,
    details: row.details,
    date: row.createdAt
  }));

  setCache(cacheKey, result);
  return result;
}

function getActivityTimeline(filters = {}) {
  const cacheKey = { type: 'timeline', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { where, params } = buildFilterClause(filters);
  const rows = db.prepare(`
    SELECT
      date(createdAt) AS period,
      COUNT(*) AS count
    FROM activity_logs
    ${where}
    GROUP BY date(createdAt)
    ORDER BY period ASC
    LIMIT 30
  `).all(params);

  const result = rows.map((row) => ({ period: row.period, count: row.count }));
  setCache(cacheKey, result);
  return result;
}

function getCompleteDashboardStats(filters = {}) {
  const cacheKey = { type: 'dashboard', filters };
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const result = {
    accountStatistics: getTotalAccounts(filters),
    statusStatistics: getAccountStatusStats(filters),
    rankStatistics: getRankStats(filters),
    inventoryStatistics: getInventoryStats(filters),
    recentActivity: getRecentActivity(filters),
    activityTimeline: getActivityTimeline(filters)
  };

  setCache(cacheKey, result);
  return result;
}

function exportStatisticsJson(filters = {}) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    filters,
    summary: getCompleteDashboardStats(filters)
  }, null, 2);
}

function exportStatisticsCsv(filters = {}) {
  const dashboard = getCompleteDashboardStats(filters);
  const rows = [];

  rows.push(['Export date', new Date().toISOString()]);
  rows.push(['Filters', JSON.stringify(filters)]);
  rows.push([]);
  rows.push(['Account statistic', 'Value']);

  const accountStats = dashboard.accountStatistics;
  Object.entries(accountStats).forEach(([key, value]) => rows.push([key, value]));

  rows.push([]);
  rows.push(['Status statistic', 'Value']);
  const statusStats = dashboard.statusStatistics;
  Object.entries(statusStats).forEach(([key, value]) => rows.push([key, value]));

  rows.push([]);
  rows.push(['Rank statistic', 'Value']);
  const rankStats = dashboard.rankStatistics;
  Object.entries(rankStats).forEach(([key, value]) => {
    if (key === 'rankDistribution') {
      rows.push(['rankDistribution', JSON.stringify(value)]);
    } else {
      rows.push([key, value]);
    }
  });

  rows.push([]);
  rows.push(['Inventory statistic', 'Value']);
  const inventoryStats = dashboard.inventoryStatistics;
  Object.entries(inventoryStats).forEach(([key, value]) => {
    if (key === 'inventoryDistribution') {
      rows.push(['inventoryDistribution', JSON.stringify(value)]);
    } else {
      rows.push([key, value]);
    }
  });

  return rows.map((columns) => columns.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function clearStatisticsCache() {
  clearCache();
}

function logActivity(action, accountId, accountName, details) {
  const now = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO activity_logs (accountId, accountName, action, details, createdAt)
      VALUES (@accountId, @accountName, @action, @details, @createdAt)
    `).run({
      accountId,
      accountName: accountName || null,
      action,
      details: details || null,
      createdAt: now
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
}

module.exports = {
  getTotalAccounts,
  getAccountStatusStats,
  getRankStats,
  getInventoryStats,
  getRecentActivity,
  getCompleteDashboardStats,
  exportStatisticsJson,
  exportStatisticsCsv,
  clearStatisticsCache,
  logActivity
};
