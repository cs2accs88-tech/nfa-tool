import { describe, it, expect } from 'vitest';
const {
  generateProfileURL,
  generateCustomURL,
  generateBothURLs,
  isInValidRange
} = require('../../../src/steam/steamLinkGenerator');

describe('steamLinkGenerator', () => {
  describe('generateProfileURL', () => {
    it('should generate a valid profile URL from a valid SteamID64', () => {
      const result = generateProfileURL('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://steamcommunity.com/profiles/76561198012345678');
    });

    it('should trim whitespace from input', () => {
      const result = generateProfileURL('  76561198012345678  ');
      expect(result.success).toBe(true);
      expect(result.url).toContain('76561198012345678');
    });

    it('should remove internal spaces', () => {
      const result = generateProfileURL('7656 1198 0123 45678');
      expect(result.success).toBe(true);
    });

    it('should reject null input', () => {
      const result = generateProfileURL(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined input', () => {
      const result = generateProfileURL(undefined);
      expect(result.success).toBe(false);
    });

    it('should reject non-17-digit strings', () => {
      const result = generateProfileURL('1234567890');
      expect(result.success).toBe(false);
      expect(result.error).toContain('17 digits');
    });

    it('should reject strings with letters', () => {
      const result = generateProfileURL('7656119801234abc');
      expect(result.success).toBe(false);
    });

    it('should reject SteamID64 below valid range', () => {
      const result = generateProfileURL('00000000000000001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('range');
    });

    it('should accept the minimum valid SteamID64', () => {
      const result = generateProfileURL('76561197960265728');
      expect(result.success).toBe(true);
    });
  });

  describe('generateCustomURL', () => {
    it('should generate a valid custom URL from a slug', () => {
      const result = generateCustomURL('myprofile');
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://steamcommunity.com/id/myprofile');
    });

    it('should accept underscores and hyphens', () => {
      const result = generateCustomURL('my_profile-name');
      expect(result.success).toBe(true);
    });

    it('should reject empty string', () => {
      const result = generateCustomURL('');
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = generateCustomURL(null);
      expect(result.success).toBe(false);
    });

    it('should reject slugs shorter than 2 characters', () => {
      const result = generateCustomURL('a');
      expect(result.success).toBe(false);
    });

    it('should reject slugs longer than 32 characters', () => {
      const result = generateCustomURL('a'.repeat(33));
      expect(result.success).toBe(false);
    });

    it('should reject slugs with special characters', () => {
      const result = generateCustomURL('my profile!');
      expect(result.success).toBe(false);
    });
  });

  describe('generateBothURLs', () => {
    it('should generate both URLs when both inputs are valid', () => {
      const result = generateBothURLs('76561198012345678', 'myprofile');
      expect(result.success).toBe(true);
      expect(result.profileUrl).toContain('/profiles/');
      expect(result.customUrl).toContain('/id/');
    });

    it('should generate only profile URL when no slug provided', () => {
      const result = generateBothURLs('76561198012345678', null);
      expect(result.success).toBe(true);
      expect(result.profileUrl).toBeTruthy();
      expect(result.customUrl).toBeNull();
    });

    it('should fail when SteamID64 is invalid and no slug', () => {
      const result = generateBothURLs('invalid', null);
      expect(result.success).toBe(false);
    });
  });

  describe('isInValidRange', () => {
    it('should return true for a valid SteamID64', () => {
      expect(isInValidRange('76561198012345678')).toBe(true);
    });

    it('should return false for a value below minimum', () => {
      expect(isInValidRange('00000000000000001')).toBe(false);
    });

    it('should return false for non-numeric input', () => {
      expect(isInValidRange('not-a-number')).toBe(false);
    });
  });
});
