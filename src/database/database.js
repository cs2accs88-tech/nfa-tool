const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databaseFolder = path.join(__dirname);
const databaseFile = path.join(databaseFolder, process.env.STEAM_MANAGER_DB || 'steamanager.db');
let db;

function ensureDatabaseFolder() {
  if (!fs.existsSync(databaseFolder)) {
    fs.mkdirSync(databaseFolder, { recursive: true });
  }
}

function createSchema(database) {
  database.prepare(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      steamId64 TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      displayName TEXT,
      profileUrl TEXT,
      accountCreated TEXT,
      country TEXT,
      notes TEXT,

      competitiveRank INTEGER,
      premierRating INTEGER,
      level INTEGER,
      xp INTEGER,
      hoursPlayed REAL,
      lastGamePlayed TEXT,

      primeStatus INTEGER NOT NULL DEFAULT 0,
      vacStatus INTEGER NOT NULL DEFAULT 0,
      gameBanStatus INTEGER NOT NULL DEFAULT 0,
      tradeRestrictionStatus INTEGER NOT NULL DEFAULT 0,
      communityBanStatus INTEGER NOT NULL DEFAULT 0,
      cooldownStatus INTEGER NOT NULL DEFAULT 0,
      verificationStatus INTEGER NOT NULL DEFAULT 0,

      inventoryValue REAL NOT NULL DEFAULT 0,
      inventoryItems INTEGER NOT NULL DEFAULT 0,
      rareItems INTEGER NOT NULL DEFAULT 0,
      inventoryPrivacy TEXT NOT NULL DEFAULT 'public',
      lastInventoryUpdate TEXT,

      serviceMedals INTEGER NOT NULL DEFAULT 0,
      medalList TEXT,
      achievementCount INTEGER NOT NULL DEFAULT 0,
      specialBadges TEXT,

      dateAdded TEXT NOT NULL,
      lastUpdated TEXT NOT NULL,
      lastChecked TEXT,
      checkHistory TEXT,
      changesLog TEXT,
      tags TEXT
    )
  `).run();

  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_steamId64 ON accounts(steamId64)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_displayName ON accounts(displayName)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_competitiveRank ON accounts(competitiveRank)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_primeStatus ON accounts(primeStatus)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_vacStatus ON accounts(vacStatus)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_inventoryValue ON accounts(inventoryValue)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_lastChecked ON accounts(lastChecked)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_dateAdded ON accounts(dateAdded)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_lastUpdated ON accounts(lastUpdated)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_accounts_tags ON accounts(tags)').run();

  database.prepare(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accountId INTEGER,
      accountName TEXT,
      action TEXT NOT NULL,
      details TEXT,
      createdAt TEXT NOT NULL
    )
  `).run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_createdAt ON activity_logs(createdAt)').run();
  database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_accountId ON activity_logs(accountId)').run();
}

function initDatabase() {
  if (db) {
    return db;
  }

  ensureDatabaseFolder();
  db = new Database(databaseFile);
  createSchema(db);

  return db;
}

function getDatabase() {
  if (!db) {
    initDatabase();
  }

  return db;
}

module.exports = {
  initDatabase,
  getDatabase
};
