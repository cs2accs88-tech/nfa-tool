const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  resolveProfile,
  detectInputType,
  extractSteamId64FromURL,
  extractCustomSlugFromURL
} = require('../../src/steam/steamResolver');

describe('steamResolver', () => {
  describe('detectInputType', () => {
    it('should detect a raw SteamID64', () => {
      assert.strictEqual(detectInputType('76561198012345678'), 'steamid64');
    });

    it('should detect a profile URL', () => {
      assert.strictEqual(detectInputType('https://steamcommunity.com/profiles/76561198012345678'), 'profileUrl');
    });

    it('should detect a custom URL', () => {
      assert.strictEqual(detectInputType('https://steamcommunity.com/id/example'), 'customUrl');
    });

    it('should detect a slug', () => {
      assert.strictEqual(detectInputType('myprofile'), 'slug');
    });

    it('should return unknown for invalid input', () => {
      assert.strictEqual(detectInputType('!!!invalid!!!'), 'unknown');
    });

    it('should return unknown for null', () => {
      assert.strictEqual(detectInputType(null), 'unknown');
    });
  });

  describe('extractSteamId64FromURL', () => {
    it('should extract SteamID64 from a valid profile URL', () => {
      const result = extractSteamId64FromURL('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result, '76561198012345678');
    });

    it('should extract with trailing slash', () => {
      const result = extractSteamId64FromURL('https://steamcommunity.com/profiles/76561198012345678/');
      assert.strictEqual(result, '76561198012345678');
    });

    it('should return null for custom URL', () => {
      const result = extractSteamId64FromURL('https://steamcommunity.com/id/example');
      assert.strictEqual(result, null);
    });

    it('should return null for invalid URL', () => {
      const result = extractSteamId64FromURL('not-a-url');
      assert.strictEqual(result, null);
    });
  });

  describe('extractCustomSlugFromURL', () => {
    it('should extract slug from a custom URL', () => {
      const result = extractCustomSlugFromURL('https://steamcommunity.com/id/example');
      assert.strictEqual(result, 'example');
    });

    it('should extract with trailing slash', () => {
      const result = extractCustomSlugFromURL('https://steamcommunity.com/id/myname/');
      assert.strictEqual(result, 'myname');
    });

    it('should return null for profile URL', () => {
      const result = extractCustomSlugFromURL('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result, null);
    });

    it('should return null for invalid URL', () => {
      const result = extractCustomSlugFromURL('not-a-url');
      assert.strictEqual(result, null);
    });
  });

  describe('resolveProfile', () => {
    it('should resolve a SteamID64 into a profile object', () => {
      const result = resolveProfile('76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profile.steamID64, '76561198012345678');
      assert.strictEqual(result.profile.profileURL, 'https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.profile.type, 'steamid64');
    });

    it('should resolve a profile URL', () => {
      const result = resolveProfile('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profile.steamID64, '76561198012345678');
      assert.strictEqual(result.profile.type, 'steamid64');
    });

    it('should resolve a custom URL', () => {
      const result = resolveProfile('https://steamcommunity.com/id/example');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profile.type, 'custom');
      assert.ok(result.profile.customURL.includes('/id/example'));
    });

    it('should resolve a slug with steamId64 option', () => {
      const result = resolveProfile('myprofile', { steamId64: '76561198012345678' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profile.steamID64, '76561198012345678');
      assert.ok(result.profile.customURL.includes('/id/myprofile'));
    });

    it('should fail for null input', () => {
      const result = resolveProfile(null);
      assert.strictEqual(result.success, false);
    });

    it('should fail for invalid input', () => {
      const result = resolveProfile('!!!');
      assert.strictEqual(result.success, false);
    });
  });
});
