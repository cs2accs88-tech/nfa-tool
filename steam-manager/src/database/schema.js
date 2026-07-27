const { getDatabase } = require('./connection');

function createSchema() {
  const db = getDatabase();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      steamId64 TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      displayName TEXT,
      profileUrl TEXT,
      notes TEXT,
      tags TEXT,
      primeStatus INTEGER NOT NULL DEFAULT 0,
      vacStatus INTEGER NOT NULL DEFAULT 0,
      gameBanStatus INTEGER NOT NULL DEFAULT 0,
      cooldownStatus INTEGER NOT NULL DEFAULT 0,
      accountStatus TEXT,
      rank INTEGER,
      level INTEGER,
      hoursPlayed REAL,
      rating REAL,
      inventoryValue REAL NOT NULL DEFAULT 0,
      itemCount INTEGER NOT NULL DEFAULT 0,
      rareItemCount INTEGER NOT NULL DEFAULT 0,
      medalCount INTEGER NOT NULL DEFAULT 0,
      medalsList TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastCheckedAt TEXT
    )
  `).run();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_steamId64 ON accounts(steamId64)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_rank ON accounts(rank)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_primeStatus ON accounts(primeStatus)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_vacStatus ON accounts(vacStatus)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_lastCheckedAt ON accounts(lastCheckedAt)').run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      component TEXT,
      message TEXT,
      payload TEXT,
      createdAt TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      fileType TEXT NOT NULL,
      recordCount INTEGER NOT NULL,
      importedCount INTEGER NOT NULL,
      duplicateCount INTEGER NOT NULL,
      failedCount INTEGER NOT NULL,
      errors TEXT,
      createdAt TEXT NOT NULL
    )
  `).run();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_import_history_createdAt ON import_history(createdAt)').run();
}

module.exports = {
  createSchema
};
