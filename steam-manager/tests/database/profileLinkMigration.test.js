const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Use a temporary test database
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-migration.db');

describe('profileLinkMigration', () => {
  let db;

  before(() => {
    // Ensure data directory exists
    const dataDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Clean up any previous test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Set environment variable to use test database
    process.env.DATABASE_FILE = 'test-migration.db';

    // Create test database with base schema
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

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

    // Insert a test account
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198012345678', 'testuser', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();

    db.close();
  });

  after(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    delete process.env.DATABASE_FILE;
  });

  it('should add profile link columns to accounts table', () => {
    // Re-require to use test database
    delete require.cache[require.resolve('../../src/database/connection')];
    delete require.cache[require.resolve('../../src/database/databaseConfig')];
    delete require.cache[require.resolve('../../src/database/migrations/profileLinkMigration')];

    process.env.DATABASE_FILE = 'test-migration.db';

    const { runMigration, isMigrationApplied } = require('../../src/database/migrations/profileLinkMigration');

    const result = runMigration();
    assert.strictEqual(result.success, true);
    assert.ok(result.changes.length > 0);

    // Verify migration is marked as applied
    assert.strictEqual(isMigrationApplied(), true);
  });

  it('should be idempotent (safe to run twice)', () => {
    const { runMigration } = require('../../src/database/migrations/profileLinkMigration');

    const result = runMigration();
    assert.strictEqual(result.success, true);
    // No new changes on second run
    assert.strictEqual(result.changes.length, 0);
  });

  it('should populate existing accounts with profile URLs', () => {
    const { populateExistingAccounts } = require('../../src/database/migrations/profileLinkMigration');
    const { getDatabase } = require('../../src/database/connection');

    const result = populateExistingAccounts();
    assert.strictEqual(result.success, true);

    // Check the account was updated
    const db = getDatabase();
    const account = db.prepare('SELECT steamProfileURL FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    assert.strictEqual(account.steamProfileURL, 'https://steamcommunity.com/profiles/76561198012345678');
  });

  it('should support rollback', () => {
    const { rollbackMigration } = require('../../src/database/migrations/profileLinkMigration');

    const result = rollbackMigration();
    assert.strictEqual(result.success, true);
    assert.ok(result.changes.length > 0);
  });
});
