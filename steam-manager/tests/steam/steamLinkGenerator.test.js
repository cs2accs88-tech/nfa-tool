const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  generateProfileURL,
  generateCustomURL,
  generateBothURLs,
  isInValidRange
} = require('../../src/steam/steamLinkGenerator');

describe('steamLinkGenerator', () => {
  describe('generateProfileURL', () => {
    it('should generate a valid profile URL from a valid SteamID64', () => {
      const result = generateProfileURL('76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.url, 'https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should trim whitespace from input', () => {
      const result = generateProfileURL('  76561198012345678  ');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.url, 'https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should remove internal spaces', () => {
      const result = generateProfileURL('7656 1198 0123 45678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.url, 'https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should reject null input', () => {
      const result = generateProfileURL(null);
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('required'));
    });

    it('should reject undefined input', () => {
      const result = generateProfileURL(undefined);
      assert.strictEqual(result.success, false);
    });

    it('should reject non-17-digit strings', () => {
      const result = generateProfileURL('1234567890');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('17 digits'));
    });

    it('should reject strings with letters', () => {
      const result = generateProfileURL('7656119801234abc');
      assert.strictEqual(result.success, false);
    });

    it('should reject SteamID64 below valid range', () => {
      const result = generateProfileURL('00000000000000001');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('range'));
    });
  });

  describe('generateCustomURL', () => {
    it('should generate a valid custom URL from a slug', () => {
      const result = generateCustomURL('myprofile');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.url, 'https://steamcommunity.com/id/myprofile');
    });

    it('should accept underscores and hyphens', () => {
      const result = generateCustomURL('my_profile-name');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.url, 'https://steamcommunity.com/id/my_profile-name');
    });

    it('should reject empty string', () => {
      const result = generateCustomURL('');
      assert.strictEqual(result.success, false);
    });

    it('should reject null', () => {
      const result = generateCustomURL(null);
      assert.strictEqual(result.success, false);
    });

    it('should reject slugs shorter than 2 characters', () => {
      const result = generateCustomURL('a');
      assert.strictEqual(result.success, false);
    });

    it('should reject slugs longer than 32 characters', () => {
      const result = generateCustomURL('a'.repeat(33));
      assert.strictEqual(result.success, false);
    });

    it('should reject slugs with special characters', () => {
      const result = generateCustomURL('my profile!');
      assert.strictEqual(result.success, false);
    });
  });

  describe('generateBothURLs', () => {
    it('should generate both URLs when both inputs are valid', () => {
      const result = generateBothURLs('76561198012345678', 'myprofile');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profileUrl, 'https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.customUrl, 'https://steamcommunity.com/id/myprofile');
    });

    it('should generate only profile URL when no slug provided', () => {
      const result = generateBothURLs('76561198012345678', null);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profileUrl, 'https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.customUrl, null);
    });

    it('should fail when SteamID64 is invalid and no slug', () => {
      const result = generateBothURLs('invalid', null);
      assert.strictEqual(result.success, false);
    });
  });

  describe('isInValidRange', () => {
    it('should return true for a valid SteamID64', () => {
      assert.strictEqual(isInValidRange('76561198012345678'), true);
    });

    it('should return false for a value below minimum', () => {
      assert.strictEqual(isInValidRange('00000000000000001'), false);
    });

    it('should return false for non-numeric input', () => {
      assert.strictEqual(isInValidRange('not-a-number'), false);
    });
  });
});
