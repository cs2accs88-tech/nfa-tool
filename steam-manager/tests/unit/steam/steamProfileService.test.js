import { describe, it, expect } from 'vitest';
const {
  generateProfileLink,
  validateProfileLink,
  updateProfileLink,
  deleteProfileLink,
  openProfileLink,
  copyProfileLink,
  extractSteamID,
  resolveProfileLink
} = require('../../../src/steam/steamProfileService');

describe('steamProfileService', () => {
  describe('generateProfileLink', () => {
    it('should generate a profile link from a valid SteamID64', () => {
      const result = generateProfileLink('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.data.steamProfileURL).toContain('76561198012345678');
      expect(result.data.profileValidationStatus).toBe('valid');
    });

    it('should generate with custom slug', () => {
      const result = generateProfileLink('76561198012345678', 'myprofile');
      expect(result.success).toBe(true);
      expect(result.data.customProfileURL).toContain('/id/myprofile');
    });

    it('should fail for missing SteamID64', () => {
      expect(generateProfileLink(null).success).toBe(false);
    });

    it('should fail for invalid SteamID64', () => {
      expect(generateProfileLink('invalid').success).toBe(false);
    });
  });

  describe('validateProfileLink', () => {
    it('should validate a correct URL', () => {
      const result = validateProfileLink('https://steamcommunity.com/profiles/76561198012345678');
      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
    });

    it('should report invalid URL', () => {
      const result = validateProfileLink('https://evil.com/profiles/123');
      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(false);
    });
  });

  describe('updateProfileLink', () => {
    it('should update with a valid new URL', () => {
      const current = { steamProfileURL: 'https://steamcommunity.com/profiles/76561198012345678', customProfileURL: null };
      const result = updateProfileLink(current, { customProfileURL: 'https://steamcommunity.com/id/newname' });
      expect(result.success).toBe(true);
      expect(result.data.customProfileURL).toContain('/id/newname');
    });

    it('should fail with invalid URL', () => {
      const current = { steamProfileURL: null, customProfileURL: null };
      const result = updateProfileLink(current, { steamProfileURL: 'https://evil.com/bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteProfileLink', () => {
    it('should prepare deletion data', () => {
      const result = deleteProfileLink(1);
      expect(result.success).toBe(true);
      expect(result.data.steamProfileURL).toBeNull();
    });

    it('should fail without account ID', () => {
      expect(deleteProfileLink(null).success).toBe(false);
    });
  });

  describe('openProfileLink', () => {
    it('should approve safe Steam URLs', () => {
      const result = openProfileLink('https://steamcommunity.com/profiles/76561198012345678');
      expect(result.success).toBe(true);
      expect(result.safe).toBe(true);
    });

    it('should reject unsafe URLs', () => {
      expect(openProfileLink('javascript:alert(1)').success).toBe(false);
    });

    it('should reject null', () => {
      expect(openProfileLink(null).success).toBe(false);
    });
  });

  describe('copyProfileLink', () => {
    it('should return the URL for copy', () => {
      const result = copyProfileLink('https://steamcommunity.com/profiles/76561198012345678');
      expect(result.success).toBe(true);
      expect(result.text).toBe('https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should fail for empty URL', () => {
      expect(copyProfileLink('   ').success).toBe(false);
    });
  });

  describe('extractSteamID', () => {
    it('should extract from a raw SteamID64', () => {
      const result = extractSteamID('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.steamId64).toBe('76561198012345678');
    });

    it('should extract from a profile URL', () => {
      const result = extractSteamID('https://steamcommunity.com/profiles/76561198012345678');
      expect(result.success).toBe(true);
      expect(result.steamId64).toBe('76561198012345678');
    });

    it('should fail for null', () => {
      expect(extractSteamID(null).success).toBe(false);
    });
  });

  describe('resolveProfileLink', () => {
    it('should resolve a SteamID64', () => {
      const result = resolveProfileLink('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
    });
  });
});
