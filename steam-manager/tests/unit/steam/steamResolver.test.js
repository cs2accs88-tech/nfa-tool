import { describe, it, expect } from 'vitest';
const {
  resolveProfile,
  detectInputType,
  extractSteamId64FromURL,
  extractCustomSlugFromURL
} = require('../../../src/steam/steamResolver');

describe('steamResolver', () => {
  describe('detectInputType', () => {
    it('should detect a raw SteamID64', () => {
      expect(detectInputType('76561198012345678')).toBe('steamid64');
    });

    it('should detect a profile URL', () => {
      expect(detectInputType('https://steamcommunity.com/profiles/76561198012345678')).toBe('profileUrl');
    });

    it('should detect a custom URL', () => {
      expect(detectInputType('https://steamcommunity.com/id/example')).toBe('customUrl');
    });

    it('should detect a slug', () => {
      expect(detectInputType('myprofile')).toBe('slug');
    });

    it('should return unknown for invalid input', () => {
      expect(detectInputType('!!!invalid!!!')).toBe('unknown');
    });

    it('should return unknown for null', () => {
      expect(detectInputType(null)).toBe('unknown');
    });
  });

  describe('extractSteamId64FromURL', () => {
    it('should extract SteamID64 from a valid profile URL', () => {
      expect(extractSteamId64FromURL('https://steamcommunity.com/profiles/76561198012345678'))
        .toBe('76561198012345678');
    });

    it('should handle trailing slash', () => {
      expect(extractSteamId64FromURL('https://steamcommunity.com/profiles/76561198012345678/'))
        .toBe('76561198012345678');
    });

    it('should return null for custom URL', () => {
      expect(extractSteamId64FromURL('https://steamcommunity.com/id/example')).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(extractSteamId64FromURL('not-a-url')).toBeNull();
    });
  });

  describe('extractCustomSlugFromURL', () => {
    it('should extract slug from a custom URL', () => {
      expect(extractCustomSlugFromURL('https://steamcommunity.com/id/example')).toBe('example');
    });

    it('should return null for profile URL', () => {
      expect(extractCustomSlugFromURL('https://steamcommunity.com/profiles/76561198012345678')).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(extractCustomSlugFromURL('not-a-url')).toBeNull();
    });
  });

  describe('resolveProfile', () => {
    it('should resolve a SteamID64 into a profile object', () => {
      const result = resolveProfile('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.profile.steamID64).toBe('76561198012345678');
      expect(result.profile.profileURL).toContain('/profiles/');
      expect(result.profile.type).toBe('steamid64');
    });

    it('should resolve a profile URL', () => {
      const result = resolveProfile('https://steamcommunity.com/profiles/76561198012345678');
      expect(result.success).toBe(true);
      expect(result.profile.steamID64).toBe('76561198012345678');
    });

    it('should resolve a custom URL', () => {
      const result = resolveProfile('https://steamcommunity.com/id/example');
      expect(result.success).toBe(true);
      expect(result.profile.type).toBe('custom');
    });

    it('should resolve a slug with steamId64 option', () => {
      const result = resolveProfile('myprofile', { steamId64: '76561198012345678' });
      expect(result.success).toBe(true);
      expect(result.profile.customURL).toContain('/id/myprofile');
    });

    it('should fail for null input', () => {
      expect(resolveProfile(null).success).toBe(false);
    });

    it('should fail for unresolvable input', () => {
      expect(resolveProfile('!!!').success).toBe(false);
    });
  });
});
