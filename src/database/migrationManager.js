const CURRENT_SCHEMA_VERSION = 1;

function createMetadataTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run();
}

function getSchemaVersion(db) {
  createMetadataTable(db);
  const row = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('schema_version');
  return row ? Number(row.value) : 0;
}

function setSchemaVersion(db, version) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO schema_meta (key, value, updatedAt)
    VALUES (@key, @value, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET value = @value, updatedAt = @updatedAt
  `).run({ key: 'schema_version', value: String(version), updatedAt: now });
}

function applyPendingMigrations(db, currentVersion) {
  const migrations = {
    1: () => {
      // Initial schema is managed by database.createSchema.
      // Future migrations can be added here.
    }
  };

  for (let version = currentVersion + 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
    const migration = migrations[version];
    if (typeof migration === 'function') {
      migration();
    }
  }

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
  }
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  createMetadataTable,
  getSchemaVersion,
  setSchemaVersion,
  applyPendingMigrations
};