import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');

const TEST_DB_DIR = path.join(__dirname, '..', '..', 'data');
const TEST_DB_FILE = 'test-import-integration.db';

describe('Import → Database Integration', () => {
  let importService, accountService, db;

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

    importService = require('../../src/imports/importService');
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

  it('should import JSON accounts into database', () => {
    const jsonContent = JSON.stringify([
      { steamId64: '76561198011111111', username: 'importuser1' },
      { steamId64: '76561198022222222', username: 'importuser2' },
      { steamId64: '76561198033333333', username: 'importuser3' }
    ]);

    const result = importService.processImportFile('accounts.json', jsonContent);
    expect(result.summary.importedCount).toBe(3);
    expect(result.summary.failedCount).toBe(0);
  });

  it('should make imported accounts searchable', () => {
    const result = accountService.searchAccounts('importuser1');
    expect(result.success).toBe(true);
    expect(result.accounts.length).toBe(1);
    expect(result.accounts[0].steamId64).toBe('76561198011111111');
  });

  it('should auto-generate profile URLs during import', () => {
    const account = db.prepare('SELECT steamProfileURL FROM accounts WHERE steamId64 = ?').get('76561198011111111');
    expect(account.steamProfileURL).toBe('https://steamcommunity.com/profiles/76561198011111111');
  });

  it('should handle duplicate imports gracefully', () => {
    const jsonContent = JSON.stringify([
      { steamId64: '76561198011111111', username: 'importuser1' }
    ]);
    const result = importService.processImportFile('dup.json', jsonContent);
    expect(result.summary.duplicateCount).toBe(1);
    expect(result.summary.importedCount).toBe(0);
  });

  it('should handle invalid records without stopping import', () => {
    const jsonContent = JSON.stringify([
      { steamId64: 'invalid', username: 'baduser' },
      { steamId64: '76561198044444444', username: 'gooduser' }
    ]);
    const result = importService.processImportFile('mixed.json', jsonContent);
    expect(result.summary.importedCount).toBe(1);
    expect(result.summary.failedCount).toBe(1);
  });

  it('should import CSV accounts', () => {
    const csvContent = 'steamid64,username\n76561198055555555,csvuser1\n76561198066666666,csvuser2';
    const result = importService.processImportFile('test.csv', csvContent);
    expect(result.summary.importedCount).toBe(2);
  });

  it('should store import history', () => {
    const history = importService.getImportHistory(10);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].fileName).toBeDefined();
    expect(history[0].importedCount).toBeDefined();
  });
});
