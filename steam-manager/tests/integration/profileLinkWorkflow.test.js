import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const path = require('path');
const fs = require('fs');

const TEST_DB_DIR = path.join(__dirname, '..', '..', 'data');
const TEST_DB_FILE = 'test-profile-workflow.db';

describe('Profile Link Workflow Integration', () => {
  let profileService, db;

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

    // Insert test account
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198012345678', 'workflowtest', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();

    profileService = require('../../src/services/profileService');
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

  it('should generate profile link from SteamID64', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.generateAndSaveProfileLink(account.id);
    expect(result.success).toBe(true);
    expect(result.data.steamProfileURL).toContain('76561198012345678');
  });

  it('should validate the generated profile link', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.validateAndUpdateProfileLink(account.id);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
    expect(result.data.status).toBe('valid');
  });

  it('should update profile link with custom URL', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.updateProfileLink(account.id, {
      customProfileURL: 'https://steamcommunity.com/id/workflowtest'
    });
    expect(result.success).toBe(true);
    expect(result.data.customProfileURL).toContain('/id/workflowtest');
  });

  it('should track profile link history', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.getProfileLinkHistory(account.id);
    expect(result.success).toBe(true);
    expect(result.history.length).toBeGreaterThan(0);
  });

  it('should prepare profile for safe opening', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.openProfile(account.id);
    expect(result.success).toBe(true);
    expect(result.url).toContain('steamcommunity.com');
  });

  it('should prepare profile for clipboard copy', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.copyProfile(account.id);
    expect(result.success).toBe(true);
    expect(result.text).toContain('steamcommunity.com');
  });

  it('should delete profile link', () => {
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198012345678');
    const result = profileService.deleteProfileLink(account.id);
    expect(result.success).toBe(true);

    const updated = db.prepare('SELECT steamProfileURL FROM accounts WHERE id = ?').get(account.id);
    expect(updated.steamProfileURL).toBeNull();
  });

  it('should batch generate profile links', () => {
    // Re-add an account without profile URL
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198088888888', 'batchtest', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();

    const result = profileService.batchGenerateProfileLinks();
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBeGreaterThanOrEqual(1);
  });

  it('should search accounts by profile URL', () => {
    Object.keys(require.cache)
      .filter((k) => k.includes('accountService'))
      .forEach((k) => delete require.cache[k]);

    const accountService = require('../../src/services/accountService');
    const result = accountService.searchAccounts('steamcommunity.com/profiles/76561198088888888');
    expect(result.success).toBe(true);
    expect(result.accounts.length).toBeGreaterThan(0);
  });
});
