import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');

// Use a test database
const TEST_DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TEST_DB_FILE = 'test-account-service.db';

describe('accountService', () => {
  let accountService;

  beforeAll(() => {
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    process.env.DATABASE_FILE = TEST_DB_FILE;

    // Clear module cache for fresh DB
    Object.keys(require.cache)
      .filter((k) => k.includes('database') || k.includes('accountService') || k.includes('accountModel') || k.includes('accountQueries'))
      .forEach((k) => delete require.cache[k]);

    const { initializeDatabase } = require('../../../src/database/database');
    initializeDatabase();

    accountService = require('../../../src/services/accountService');
  });

  afterAll(() => {
    Object.keys(require.cache)
      .filter((k) => k.includes('database') || k.includes('accountService'))
      .forEach((k) => delete require.cache[k]);

    const dbPath = path.join(TEST_DB_DIR, TEST_DB_FILE);
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    }
    delete process.env.DATABASE_FILE;
  });

  describe('createAccount', () => {
    it('should create a valid account', () => {
      const result = accountService.createAccount({
        steamId64: '76561198012345678',
        username: 'testuser',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should reject duplicate steamId64', () => {
      const result = accountService.createAccount({
        steamId64: '76561198012345678',
        username: 'duplicate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid steamId64', () => {
      const result = accountService.createAccount({
        steamId64: 'invalid',
        username: 'testuser2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getAccountById', () => {
    it('should retrieve an existing account', () => {
      const result = accountService.getAccountById(1);
      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account.username).toBe('testuser');
    });

    it('should return null for non-existent ID', () => {
      const result = accountService.getAccountById(99999);
      expect(result.success).toBe(true);
      expect(result.account).toBeNull();
    });
  });

  describe('findAccountBySteamId', () => {
    it('should find by SteamID64', () => {
      const result = accountService.findAccountBySteamId('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
    });

    it('should return null for non-existent SteamID64', () => {
      const result = accountService.findAccountBySteamId('76561198000000000');
      expect(result.success).toBe(true);
      expect(result.account).toBeNull();
    });
  });

  describe('getAllAccounts', () => {
    it('should return paginated accounts', () => {
      const result = accountService.getAllAccounts({ page: 1, pageSize: 10 });
      expect(result.success).toBe(true);
      expect(Array.isArray(result.accounts)).toBe(true);
    });
  });

  describe('searchAccounts', () => {
    it('should search by username', () => {
      const result = accountService.searchAccounts('testuser');
      expect(result.success).toBe(true);
      expect(result.accounts.length).toBeGreaterThan(0);
    });

    it('should search by steamId64', () => {
      const result = accountService.searchAccounts('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.accounts.length).toBeGreaterThan(0);
    });

    it('should return empty for non-matching query', () => {
      const result = accountService.searchAccounts('nonexistentuser12345');
      expect(result.success).toBe(true);
      expect(result.accounts).toHaveLength(0);
    });
  });

  describe('updateAccount', () => {
    it('should update an existing account', () => {
      const result = accountService.updateAccount({
        id: 1,
        steamId64: '76561198012345678',
        username: 'updateduser',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      expect(result.success).toBe(true);
    });

    it('should fail without id', () => {
      const result = accountService.updateAccount({ username: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteAccount', () => {
    it('should delete an existing account', () => {
      // Create one to delete
      accountService.createAccount({
        steamId64: '76561198099999999',
        username: 'deletetest',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const found = accountService.findAccountBySteamId('76561198099999999');
      const result = accountService.deleteAccount(found.account.id);
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
  });

  describe('filterAccounts', () => {
    it('should filter by primeStatus', () => {
      const result = accountService.filterAccounts({ primeStatus: false });
      expect(result.success).toBe(true);
      expect(Array.isArray(result.accounts)).toBe(true);
    });
  });
});
