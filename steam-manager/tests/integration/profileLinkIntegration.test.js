const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-integration.db');

describe('Profile Link Integration', () => {
  before(() => {
    const dataDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.DATABASE_FILE = 'test-integration.db';

    // Clear module cache for fresh initialization
    Object.keys(require.cache)
      .filter((key) => key.includes('steam-manager'))
      .forEach((key) => delete require.cache[key]);
  });

  after(() => {
    try {
      const { closeDatabase } = require('../../src/database/connection');
      closeDatabase();
    } catch { /* ignore */ }

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    delete process.env.DATABASE_FILE;
  });

  it('should initialize database with profile link migration', () => {
    const { initializeDatabase } = require('../../src/database/database');
    const db = initializeDatabase();
    assert.ok(db);

    // Verify columns exist
    const info = db.prepare('PRAGMA table_info(accounts)').all();
    const columnNames = info.map((col) => col.name);
    assert.ok(columnNames.includes('steamProfileURL'));
    assert.ok(columnNames.includes('customProfileURL'));
    assert.ok(columnNames.includes('profileLastChecked'));
    assert.ok(columnNames.includes('profileValidationStatus'));
  });

  it('should generate and save profile link for an account', () => {
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();

    // Insert a test account
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198099999999', 'integrationtest', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();

    const profileService = require('../../src/services/profileService');
    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198099999999');

    const result = profileService.generateAndSaveProfileLink(account.id);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.steamProfileURL, 'https://steamcommunity.com/profiles/76561198099999999');

    // Verify in database
    const updated = db.prepare('SELECT steamProfileURL, profileValidationStatus FROM accounts WHERE id = ?').get(account.id);
    assert.strictEqual(updated.steamProfileURL, 'https://steamcommunity.com/profiles/76561198099999999');
    assert.strictEqual(updated.profileValidationStatus, 'valid');
  });

  it('should validate a profile link', () => {
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();
    const profileService = require('../../src/services/profileService');

    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198099999999');
    const result = profileService.validateAndUpdateProfileLink(account.id);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.valid, true);
    assert.strictEqual(result.data.status, 'valid');
  });

  it('should update a profile link', () => {
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();
    const profileService = require('../../src/services/profileService');

    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198099999999');
    const result = profileService.updateProfileLink(account.id, {
      customProfileURL: 'https://steamcommunity.com/id/testuser'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.customProfileURL, 'https://steamcommunity.com/id/testuser');

    // Verify in database
    const updated = db.prepare('SELECT customProfileURL FROM accounts WHERE id = ?').get(account.id);
    assert.strictEqual(updated.customProfileURL, 'https://steamcommunity.com/id/testuser');
  });

  it('should track profile link history', () => {
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();
    const profileService = require('../../src/services/profileService');

    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198099999999');
    const result = profileService.getProfileLinkHistory(account.id);

    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.history));
    assert.ok(result.history.length > 0);
  });

  it('should delete a profile link', () => {
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();
    const profileService = require('../../src/services/profileService');

    const account = db.prepare('SELECT id FROM accounts WHERE steamId64 = ?').get('76561198099999999');
    const result = profileService.deleteProfileLink(account.id);

    assert.strictEqual(result.success, true);

    // Verify deleted
    const updated = db.prepare('SELECT steamProfileURL, customProfileURL FROM accounts WHERE id = ?').get(account.id);
    assert.strictEqual(updated.steamProfileURL, null);
    assert.strictEqual(updated.customProfileURL, null);
  });

  it('should batch generate profile links', () => {
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();
    const profileService = require('../../src/services/profileService');

    // Insert more test accounts without profile URLs
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198088888888', 'batchuser1', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();
    db.prepare(`
      INSERT INTO accounts (steamId64, username, createdAt, updatedAt)
      VALUES ('76561198077777777', 'batchuser2', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `).run();

    const result = profileService.batchGenerateProfileLinks();
    assert.strictEqual(result.success, true);
    assert.ok(result.updatedCount >= 2);

    // Verify accounts were updated
    const acc1 = db.prepare('SELECT steamProfileURL FROM accounts WHERE steamId64 = ?').get('76561198088888888');
    assert.strictEqual(acc1.steamProfileURL, 'https://steamcommunity.com/profiles/76561198088888888');
  });

  it('should search by profile URL', () => {
    // Clear cached module to pick up the updated accountService
    delete require.cache[require.resolve('../../src/services/accountService')];
    const accountService = require('../../src/services/accountService');

    const result = accountService.searchAccounts('steamcommunity.com/profiles/76561198088888888');
    assert.strictEqual(result.success, true);
    assert.ok(result.accounts.length > 0);
    assert.strictEqual(result.accounts[0].steamId64, '76561198088888888');
  });

  it('should integrate with import service for profile link generation', () => {
    const { processImportFile } = require('../../src/imports/importService');
    const { getDatabase } = require('../../src/database/connection');
    const db = getDatabase();

    const jsonContent = JSON.stringify([
      { steamId64: '76561198066666666', username: 'importuser1' },
      { steamId64: '76561198055555555', username: 'importuser2' }
    ]);

    const result = processImportFile('test.json', jsonContent);
    assert.ok(result.summary.importedCount >= 2);

    // Verify profile URLs were generated
    const acc = db.prepare('SELECT steamProfileURL FROM accounts WHERE steamId64 = ?').get('76561198066666666');
    assert.strictEqual(acc.steamProfileURL, 'https://steamcommunity.com/profiles/76561198066666666');
  });
});
