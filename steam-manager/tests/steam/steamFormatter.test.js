const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  formatProfileForDisplay,
  getDisplayURL,
  getURLType,
  formatSteamId64ForDisplay,
  formatURLForDisplay,
  formatValidationStatus,
  normalizeURLForStorage,
  extractSlugFromCustomURL
} = require('../../src/steam/steamFormatter');

describe('steamFormatter', () => {
  describe('formatProfileForDisplay', () => {
    it('should format a profile with SteamID64 URL', () => {
      const result = formatProfileForDisplay({
        steamId64: '76561198012345678',
        steamProfileURL: 'https://steamcommunity.com/profiles/76561198012345678',
        customProfileURL: null,
        profileValidationStatus: 'valid',
        profileLastChecked: '2025-01-01T00:00:00.000Z'
      });
      assert.strictEqual(result.steamID64, '76561198012345678');
      assert.strictEqual(result.validationStatus, 'valid');
      assert.ok(result.displayURL);
    });

    it('should return null for null input', () => {
      assert.strictEqual(formatProfileForDisplay(null), null);
    });
  });

  describe('getDisplayURL', () => {
    it('should prefer custom URL over profile URL', () => {
      const result = getDisplayURL({
        steamProfileURL: 'https://steamcommunity.com/profiles/76561198012345678',
        customProfileURL: 'https://steamcommunity.com/id/myname'
      });
      assert.strictEqual(result, 'https://steamcommunity.com/id/myname');
    });

    it('should fall back to profile URL', () => {
      const result = getDisplayURL({
        steamProfileURL: 'https://steamcommunity.com/profiles/76561198012345678',
        customProfileURL: null
      });
      assert.strictEqual(result, 'https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should return null when no URLs', () => {
      assert.strictEqual(getDisplayURL({}), null);
    });
  });

  describe('getURLType', () => {
    it('should return custom when custom URL present', () => {
      assert.strictEqual(getURLType({ customProfileURL: 'https://steamcommunity.com/id/x' }), 'custom');
    });

    it('should return steamid64 when profile URL present', () => {
      assert.strictEqual(getURLType({ steamProfileURL: 'https://steamcommunity.com/profiles/123' }), 'steamid64');
    });

    it('should return unknown when no URLs', () => {
      assert.strictEqual(getURLType({}), 'unknown');
    });
  });

  describe('formatSteamId64ForDisplay', () => {
    it('should return the full ID when within max length', () => {
      assert.strictEqual(formatSteamId64ForDisplay('76561198012345678'), '76561198012345678');
    });

    it('should return N/A for null', () => {
      assert.strictEqual(formatSteamId64ForDisplay(null), 'N/A');
    });
  });

  describe('formatURLForDisplay', () => {
    it('should strip https:// prefix', () => {
      const result = formatURLForDisplay('https://steamcommunity.com/profiles/76561198012345678');
      assert.ok(!result.startsWith('https://'));
      assert.ok(result.includes('steamcommunity.com'));
    });

    it('should return placeholder for null', () => {
      assert.strictEqual(formatURLForDisplay(null), 'No profile link');
    });

    it('should truncate long URLs', () => {
      const longUrl = 'https://steamcommunity.com/profiles/76561198012345678/some/very/long/path/that/exceeds/limit';
      const result = formatURLForDisplay(longUrl, 30);
      assert.ok(result.length <= 30);
      assert.ok(result.endsWith('...'));
    });
  });

  describe('formatValidationStatus', () => {
    it('should format valid status', () => {
      const result = formatValidationStatus('valid');
      assert.strictEqual(result.label, 'Valid');
      assert.strictEqual(result.className, 'status-valid');
    });

    it('should format invalid status', () => {
      const result = formatValidationStatus('invalid');
      assert.strictEqual(result.label, 'Invalid');
      assert.strictEqual(result.className, 'status-invalid');
    });

    it('should default to unchecked', () => {
      const result = formatValidationStatus(undefined);
      assert.strictEqual(result.label, 'Unchecked');
    });
  });

  describe('normalizeURLForStorage', () => {
    it('should lowercase the hostname', () => {
      const result = normalizeURLForStorage('https://STEAMCOMMUNITY.COM/profiles/76561198012345678');
      assert.ok(result.includes('steamcommunity.com'));
    });

    it('should remove trailing slash', () => {
      const result = normalizeURLForStorage('https://steamcommunity.com/profiles/76561198012345678/');
      assert.ok(!result.endsWith('/'));
    });

    it('should return null for empty string', () => {
      assert.strictEqual(normalizeURLForStorage(''), null);
    });

    it('should return null for null', () => {
      assert.strictEqual(normalizeURLForStorage(null), null);
    });

    it('should return null for invalid URL', () => {
      assert.strictEqual(normalizeURLForStorage('not-a-url'), null);
    });
  });

  describe('extractSlugFromCustomURL', () => {
    it('should extract slug from custom URL', () => {
      assert.strictEqual(extractSlugFromCustomURL('https://steamcommunity.com/id/example'), 'example');
    });

    it('should handle trailing slash', () => {
      assert.strictEqual(extractSlugFromCustomURL('https://steamcommunity.com/id/example/'), 'example');
    });

    it('should return null for profile URL', () => {
      assert.strictEqual(extractSlugFromCustomURL('https://steamcommunity.com/profiles/123'), null);
    });

    it('should return null for null', () => {
      assert.strictEqual(extractSlugFromCustomURL(null), null);
    });
  });
});
