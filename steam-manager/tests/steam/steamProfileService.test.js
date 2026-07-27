const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  generateProfileLink,
  validateProfileLink,
  updateProfileLink,
  deleteProfileLink,
  openProfileLink,
  copyProfileLink,
  extractSteamID,
  resolveProfileLink
} = require('../../src/steam/steamProfileService');

describe('steamProfileService', () => {
  describe('generateProfileLink', () => {
    it('should generate a profile link from a valid SteamID64', () => {
      const result = generateProfileLink('76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.steamProfileURL, 'https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.data.profileValidationStatus, 'valid');
      assert.ok(result.data.profileLastChecked);
    });

    it('should generate with custom slug', () => {
      const result = generateProfileLink('76561198012345678', 'myprofile');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.customProfileURL, 'https://steamcommunity.com/id/myprofile');
    });

    it('should fail for missing SteamID64', () => {
      const result = generateProfileLink(null);
      assert.strictEqual(result.success, false);
    });

    it('should fail for invalid SteamID64', () => {
      const result = generateProfileLink('invalid');
      assert.strictEqual(result.success, false);
    });
  });

  describe('validateProfileLink', () => {
    it('should validate a correct URL', () => {
      const result = validateProfileLink('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.valid, true);
      assert.ok(result.data.checkedAt);
    });

    it('should report invalid URL', () => {
      const result = validateProfileLink('https://evil.com/profiles/123');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.valid, false);
    });
  });

  describe('updateProfileLink', () => {
    it('should update with a valid new URL', () => {
      const current = {
        steamProfileURL: 'https://steamcommunity.com/profiles/76561198012345678',
        customProfileURL: null
      };
      const result = updateProfileLink(current, {
        customProfileURL: 'https://steamcommunity.com/id/newname'
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.customProfileURL, 'https://steamcommunity.com/id/newname');
    });

    it('should fail with invalid URL', () => {
      const current = { steamProfileURL: null, customProfileURL: null };
      const result = updateProfileLink(current, {
        steamProfileURL: 'https://evil.com/bad'
      });
      assert.strictEqual(result.success, false);
    });

    it('should allow setting URL to null', () => {
      const current = {
        steamProfileURL: 'https://steamcommunity.com/profiles/76561198012345678',
        customProfileURL: null
      };
      const result = updateProfileLink(current, { customProfileURL: null });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.customProfileURL, null);
    });
  });

  describe('deleteProfileLink', () => {
    it('should prepare deletion data', () => {
      const result = deleteProfileLink(1);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.steamProfileURL, null);
      assert.strictEqual(result.data.customProfileURL, null);
    });

    it('should fail without account ID', () => {
      const result = deleteProfileLink(null);
      assert.strictEqual(result.success, false);
    });
  });

  describe('openProfileLink', () => {
    it('should approve safe Steam URLs', () => {
      const result = openProfileLink('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.safe, true);
    });

    it('should reject unsafe URLs', () => {
      const result = openProfileLink('javascript:alert(1)');
      assert.strictEqual(result.success, false);
    });

    it('should reject null', () => {
      const result = openProfileLink(null);
      assert.strictEqual(result.success, false);
    });

    it('should reject non-Steam domains', () => {
      const result = openProfileLink('https://google.com');
      assert.strictEqual(result.success, false);
    });
  });

  describe('copyProfileLink', () => {
    it('should return the URL for copy', () => {
      const result = copyProfileLink('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.text, 'https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should fail for empty URL', () => {
      const result = copyProfileLink('   ');
      assert.strictEqual(result.success, false);
    });

    it('should fail for null', () => {
      const result = copyProfileLink(null);
      assert.strictEqual(result.success, false);
    });
  });

  describe('extractSteamID', () => {
    it('should extract from a raw SteamID64', () => {
      const result = extractSteamID('76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.steamId64, '76561198012345678');
    });

    it('should extract from a profile URL', () => {
      const result = extractSteamID('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.steamId64, '76561198012345678');
    });

    it('should fail for custom URL without SteamID64', () => {
      const result = extractSteamID('https://steamcommunity.com/id/example');
      assert.strictEqual(result.success, false);
    });

    it('should fail for null', () => {
      const result = extractSteamID(null);
      assert.strictEqual(result.success, false);
    });
  });

  describe('resolveProfileLink', () => {
    it('should resolve a SteamID64', () => {
      const result = resolveProfileLink('76561198012345678');
      assert.strictEqual(result.success, true);
      assert.ok(result.profile);
    });

    it('should fail for invalid input', () => {
      const result = resolveProfileLink('!!!invalid');
      assert.strictEqual(result.success, false);
    });
  });
});
