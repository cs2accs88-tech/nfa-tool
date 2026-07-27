import { describe, it, expect } from 'vitest';
const profileController = require('../../../src/controllers/profileController');

describe('profileController', () => {
  describe('input validation', () => {
    it('should reject non-integer accountId for generateProfileLink', () => {
      const result = profileController.generateProfileLink('not-a-number');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid account ID');
    });

    it('should reject null accountId for validateProfileLink', () => {
      const result = profileController.validateProfileLink(null);
      expect(result.success).toBe(false);
    });

    it('should reject null accountId for deleteProfileLink', () => {
      const result = profileController.deleteProfileLink(null);
      expect(result.success).toBe(false);
    });

    it('should reject null accountId for openProfileLink', () => {
      const result = profileController.openProfileLink(null);
      expect(result.success).toBe(false);
    });

    it('should reject null accountId for copyProfileLink', () => {
      const result = profileController.copyProfileLink(null);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer for getProfileLink', () => {
      const result = profileController.getProfileLink(3.5);
      expect(result.success).toBe(false);
    });

    it('should reject null for getProfileHistory', () => {
      const result = profileController.getProfileHistory(null);
      expect(result.success).toBe(false);
    });

    it('should reject null for updateProfileLink', () => {
      const result = profileController.updateProfileLink(null, {});
      expect(result.success).toBe(false);
    });

    it('should reject missing updates object', () => {
      const result = profileController.updateProfileLink(1, null);
      expect(result.success).toBe(false);
    });
  });

  describe('extractSteamId', () => {
    it('should extract from valid input', () => {
      const result = profileController.extractSteamId('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.steamId64).toBe('76561198012345678');
    });

    it('should reject null input', () => {
      const result = profileController.extractSteamId(null);
      expect(result.success).toBe(false);
    });
  });

  describe('resolveProfile', () => {
    it('should resolve valid SteamID64', () => {
      const result = profileController.resolveProfile('76561198012345678');
      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
    });

    it('should reject null input', () => {
      const result = profileController.resolveProfile(null);
      expect(result.success).toBe(false);
    });
  });
});
