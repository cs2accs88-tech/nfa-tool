import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');

const TEST_DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TEST_DB_FILE = 'test-settings-service.db';

describe('settingsService', () => {
  let settingsService;

  beforeAll(() => {
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    process.env.DATABASE_FILE = TEST_DB_FILE;

    Object.keys(require.cache)
      .filter((k) => k.includes('database') || k.includes('settingsService'))
      .forEach((k) => delete require.cache[k]);

    const { initializeDatabase } = require('../../../src/database/database');
    initializeDatabase();
    settingsService = require('../../../src/services/settingsService');
  });

  afterAll(() => {
    Object.keys(require.cache)
      .filter((k) => k.includes('database') || k.includes('settingsService'))
      .forEach((k) => delete require.cache[k]);

    const dbPath = path.join(TEST_DB_DIR, TEST_DB_FILE);
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    }
    delete process.env.DATABASE_FILE;
  });

  describe('saveSetting', () => {
    it('should save a setting', () => {
      const result = settingsService.saveSetting('theme', 'dark');
      expect(result.success).toBe(true);
    });

    it('should upsert existing setting', () => {
      settingsService.saveSetting('theme', 'dark');
      const result = settingsService.saveSetting('theme', 'light');
      expect(result.success).toBe(true);
    });
  });

  describe('getSetting', () => {
    it('should retrieve a saved setting', () => {
      settingsService.saveSetting('language', 'en');
      const result = settingsService.getSetting('language');
      expect(result.success).toBe(true);
      expect(result.value).toBe('en');
    });

    it('should return null for non-existent setting', () => {
      const result = settingsService.getSetting('nonexistent');
      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });
  });
});
