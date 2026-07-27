const cacheStore = new Map();

function makeCacheKey(filters) {
  try {
    return JSON.stringify(filters || {});
  } catch {
    return String(filters);
  }
}

function setCache(filters, data, ttlMs = 60_000) {
  const key = makeCacheKey(filters);
  const expiresAt = Date.now() + ttlMs;
  cacheStore.set(key, { data, expiresAt });
}

function getCache(filters) {
  const key = makeCacheKey(filters);
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data;
}

function clearCache() {
  cacheStore.clear();
}

module.exports = {
  getCache,
  setCache,
  clearCache
};
