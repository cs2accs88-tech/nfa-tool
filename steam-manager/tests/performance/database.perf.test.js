import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');

const TEST_DB_DIR = path.join(__dirname, '..', '..', 'data');
const TEST_DB_FILE = 'test-performance.db';

describe('Database Performance', () => {
  let db, accountService;

  beforeAll(() => {
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    const dbPath = path.join(TEST_DB_DIR, TEST_DB_FILE);
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    }

    process.env.DATABASE_FILE = TEST_DB_FILE;

    Object.keys(require.cache)
      .filter((k) => k.includes('steam-manager'))
      .forEach((k) => delete require.cache[k]);

    const { initializeDatabase, getDatabase } = require('../../src/database/database');
    initializeDatabase();
    db = getDatabase();
    accountService = require('../../src/services/accountService');
  });

  afterAll(() => {
    Object.keys(require.cache)
      .filter((k) => k.includes('steam-manager'))
      .forEach((k) => delete require.cache[k]);

    const dbPath = path.join(TEST_DB_DIR, TEST_DB_FILE);
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    }
    delete process.env.DATABASE_FILE;
  });

  it('should insert 1,000 accounts in under 2 seconds', () => {
    const insert = db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES (?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const start = Date.now();

    const transaction = db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        const steamId = `7656119801${String(i).padStart(7, '0')}`;
        insert.run(steamId, `perfuser${i}`, now, now);
      }
    });
    transaction();

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    console.log(`  1,000 inserts: ${elapsed}ms`);
  });

  it('should query all accounts (paginated) in under 100ms', () => {
    const start = Date.now();
    const result = accountService.getAllAccounts({ page: 1, pageSize: 50 });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.accounts).toHaveLength(50);
    expect(elapsed).toBeLessThan(100);
    console.log(`  Paginated query (50): ${elapsed}ms`);
  });

  it('should search 1,000 accounts in under 200ms', () => {
    const start = Date.now();
    const result = accountService.searchAccounts('perfuser5');
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.accounts.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
    console.log(`  Search query: ${elapsed}ms (${result.accounts.length} results)`);
  });

  it('should insert 10,000 accounts in under 10 seconds', () => {
    const insert = db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES (?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const start = Date.now();

    const transaction = db.transaction(() => {
      for (let i = 1000; i < 11000; i++) {
        const steamId = `7656119802${String(i).padStart(7, '0')}`;
        insert.run(steamId, `bulk${i}`, now, now);
      }
    });
    transaction();

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
    console.log(`  10,000 inserts: ${elapsed}ms`);
  });

  it('should search 11,000 accounts in under 500ms', () => {
    const start = Date.now();
    const result = accountService.searchAccounts('bulk500');
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(500);
    console.log(`  Search 11k accounts: ${elapsed}ms (${result.accounts.length} results)`);
  });

  it('should filter accounts efficiently', () => {
    const start = Date.now();
    const result = accountService.filterAccounts({ primeStatus: false }, { pageSize: 100 });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(200);
    console.log(`  Filter query: ${elapsed}ms (${result.accounts.length} results)`);
  });

  it('should handle batch profile URL generation for 1,000 accounts', () => {
    // Generate URLs for first 1000 accounts
    const updateStmt = db.prepare('UPDATE accounts SET steamProfileURL = ? WHERE steamId64 = ?');
    const accounts = db.prepare('SELECT steamId64 FROM accounts WHERE steamProfileURL IS NULL LIMIT 1000').all();

    const start = Date.now();
    const transaction = db.transaction(() => {
      for (const acc of accounts) {
        const url = `https://steamcommunity.com/profiles/${acc.steamId64}`;
        updateStmt.run(url, acc.steamId64);
      }
    });
    transaction();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(3000);
    console.log(`  Batch URL generation (${accounts.length}): ${elapsed}ms`);
  });
});
