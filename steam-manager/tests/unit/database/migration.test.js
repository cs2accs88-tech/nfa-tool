import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const TEST_DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TEST_DB_FILE = 'test-migration-unit.db';
const TEST_DB_PATH = path.join(TEST_DB_DIR, TEST_DB_FILE);

describe('profileLinkMigration', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    process.env.DATABASE_FILE = TEST_DB_FILE;

    // Create base schema manually (simulating existing database)
    const db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.prepare(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        steamId64 TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        displayName TEXT,
        profileUrl TEXT,
        notes TEXT, tags TEXT,
        primeStatus INTEGER NOT NULL DEFAULT 0,
        vacStatus INTEGER NOT NULL DEFAULT 0,
        gameBanStatus INTEGER NOT NULL DEFAULT 0,
        cooldownStatus INTEGER NOT NULL DEFAULT 0,
        accountStatus TEXT,
        rank INTEGER, level INTEGER,
        hoursPlayed REAL, rating REAL,
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
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198012345678', 'miguser', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();
    db.close();
  });

  afterAll(() => {
    Object.keys(require.cache)
      .filter((k) => k.includes('database') || k.includes('migration'))
      .forEach((k) => delete require.cache[k]);

    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(TEST_DB_PATH + ext)) fs.unlinkSync(TEST_DB_PATH + ext);
    }
    delete process.env.DATABASE_FILE;
  });

  it('should apply migration successfully', () => {
    // Clear cache
    Object.keys(require.cache)
      .filter((k) => k.includes('database') || k.includes('migration'))
      .forEach((k) => delete require.cache[k]);

    const { runMigration } = require('../../../src/database/migrations/profileLinkMigration');
    const result = runMigration();
    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('should be idempotent', () => {
    const { runMigration } = require('../../../src/database/migrations/profileLinkMigration');
    const result = runMigration();
    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0); // No new changes
  });

  it('should mark migration as applied', () => {
    const { isMigrationApplied } = require('../../../src/database/migrations/profileLinkMigration');
    expect(isMigrationApplied()).toBe(true);
  });

  it('should populate existing accounts', () => {
    const { populateExistingAccounts } = require('../../../src/database/migrations/profileLinkMigration');
    const result = populateExistingAccounts();
    expect(result.success).toBe(true);

    const { getDatabase } = require('../../../src/database/connection');
    const db = getDatabase();
    const row = db.prepare('SELECT steamProfileURL FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    expect(row.steamProfileURL).toBe('https://steamcommunity.com/profiles/76561198012345678');
  });

  it('should support rollback', () => {
    const { rollbackMigration } = require('../../../src/database/migrations/profileLinkMigration');
    const result = rollbackMigration();
    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
