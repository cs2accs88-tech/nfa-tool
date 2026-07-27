const {
  getTotalAccounts,
  getAccountStatusStats,
  getRankStats,
  getInventoryStats,
  getRecentActivity: serviceGetRecentActivity,
  getCompleteDashboardStats,
  exportStatisticsJson,
  exportStatisticsCsv,
  clearStatisticsCache
} = require('./statisticsService');

function formatResponse(success, data = null, error = null) {
  return {
    success,
    data,
    error
  };
}

function validateFilters(filters) {
  if (!filters || typeof filters !== 'object') {
    return { valid: true, filters: {} };
  }

  const validated = { ...filters };
  if (filters.tags && typeof filters.tags === 'string') {
    validated.tags = filters.tags.split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean);
  }

  ['primeStatus', 'vacStatus', 'cooldownStatus'].forEach((flag) => {
    if (filters[flag] === 'true' || filters[flag] === true) {
      validated[flag] = true;
    } else if (filters[flag] === 'false' || filters[flag] === false) {
      validated[flag] = false;
    }
  });

  ['rankMin', 'rankMax', 'inventoryMin', 'inventoryMax'].forEach((field) => {
    if (filters[field] != null) {
      const value = Number(filters[field]);
      validated[field] = Number.isFinite(value) ? value : undefined;
    }
  });

  return { valid: true, filters: validated };
}

function getDashboardStats(filters = {}) {
  const validation = validateFilters(filters);
  if (!validation.valid) {
    return formatResponse(false, null, 'Invalid filters');
  }

  try {
    const data = getCompleteDashboardStats(validation.filters);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function getStatistics(filters = {}) {
  return getDashboardStats(filters);
}

function getRecentActivity(filters = {}) {
  const validation = validateFilters(filters);
  if (!validation.valid) {
    return formatResponse(false, null, 'Invalid filters');
  }

  try {
    const data = serviceGetRecentActivity(validation.filters);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function exportJson(filters = {}) {
  const validation = validateFilters(filters);
  if (!validation.valid) {
    return formatResponse(false, null, 'Invalid filters');
  }

  try {
    const data = exportStatisticsJson(validation.filters);
    return formatResponse(true, { json: data });
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function exportCsv(filters = {}) {
  const validation = validateFilters(filters);
  if (!validation.valid) {
    return formatResponse(false, null, 'Invalid filters');
  }

  try {
    const data = exportStatisticsCsv(validation.filters);
    return formatResponse(true, { csv: data });
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function clearCache() {
  clearStatisticsCache();
  return formatResponse(true, { message: 'Statistics cache cleared.' });
}

module.exports = {
  getDashboardStats,
  getStatistics,
  getRecentActivity,
  exportJson,
  exportCsv,
  clearCache
};
