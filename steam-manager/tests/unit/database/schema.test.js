import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');

const TEST_DB_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TEST_DB_FILE = 'test-schema.db';

describe('database schema', () => {
  let db;

  beforeAll(() => {
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    process.env.DATABASE_FILE = TEST_DB_FILE;

    Object.keys(require.cache)
      .filter((k) => k.includes('database'))
      .forEach((k) => delete require.cache[k]);

    const { initializeDatabase, getDatabase } = require('../../../src/database/database');
    initializeDatabase();
    db = getDatabase();
  });

  afterAll(() => {
    Object.keys(require.cache)
      .filter((k) => k.includes('database'))
      .forEach((k) => delete require.cache[k]);

    const dbPath = path.join(TEST_DB_DIR, TEST_DB_FILE);
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    }
    delete process.env.DATABASE_FILE;
  });

  it('should create accounts table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.map((t) => t.name);
    expect(names).toContain('accounts');
  });

  it('should create settings table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map((t) => t.name)).toContain('settings');
  });

  it('should create activity_logs table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map((t) => t.name)).toContain('activity_logs');
  });

  it('should create import_history table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map((t) => t.name)).toContain('import_history');
  });

  it('should create profile_link_history table via migration', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map((t) => t.name)).toContain('profile_link_history');
  });

  it('should have steamProfileURL column in accounts', () => {
    const columns = db.prepare('PRAGMA table_info(accounts)').all();
    expect(columns.map((c) => c.name)).toContain('steamProfileURL');
  });

  it('should have customProfileURL column in accounts', () => {
    const columns = db.prepare('PRAGMA table_info(accounts)').all();
    expect(columns.map((c) => c.name)).toContain('customProfileURL');
  });

  it('should have profileLastChecked column in accounts', () => {
    const columns = db.prepare('PRAGMA table_info(accounts)').all();
    expect(columns.map((c) => c.name)).toContain('profileLastChecked');
  });

  it('should have profileValidationStatus column in accounts', () => {
    const columns = db.prepare('PRAGMA table_info(accounts)').all();
    expect(columns.map((c) => c.name)).toContain('profileValidationStatus');
  });

  it('should have indexes on steamId64 and username', () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_accounts_steamId64');
    expect(names).toContain('idx_accounts_username');
  });

  it('should support WAL journal mode', () => {
    const result = db.prepare('PRAGMA journal_mode').get();
    expect(result.journal_mode).toBe('wal');
  });

  it('should have foreign keys enabled', () => {
    const result = db.prepare('PRAGMA foreign_keys').get();
    expect(result.foreign_keys).toBe(1);
  });
});
