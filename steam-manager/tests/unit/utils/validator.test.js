import { describe, it, expect } from 'vitest';
const {
  validateAccountData,
  isValidSteamId64,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isValidDateString
} = require('../../../src/utils/validator');

describe('validator', () => {
  describe('isValidSteamId64', () => {
    it('should accept valid 17-digit string', () => {
      expect(isValidSteamId64('76561198012345678')).toBe(true);
    });

    it('should reject shorter strings', () => {
      expect(isValidSteamId64('7656119801234567')).toBe(false);
    });

    it('should reject longer strings', () => {
      expect(isValidSteamId64('765611980123456789')).toBe(false);
    });

    it('should reject non-digit strings', () => {
      expect(isValidSteamId64('7656119801234567a')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidSteamId64(null)).toBe(false);
    });

    it('should reject numbers', () => {
      expect(isValidSteamId64(76561198012345678)).toBe(false);
    });
  });

  describe('isNonNegativeInteger', () => {
    it('should accept 0', () => {
      expect(isNonNegativeInteger(0)).toBe(true);
    });

    it('should accept positive integers', () => {
      expect(isNonNegativeInteger(42)).toBe(true);
    });

    it('should reject negative integers', () => {
      expect(isNonNegativeInteger(-1)).toBe(false);
    });

    it('should reject floats', () => {
      expect(isNonNegativeInteger(3.14)).toBe(false);
    });

    it('should reject strings', () => {
      expect(isNonNegativeInteger('5')).toBe(false);
    });
  });

  describe('isNonNegativeNumber', () => {
    it('should accept 0', () => {
      expect(isNonNegativeNumber(0)).toBe(true);
    });

    it('should accept floats', () => {
      expect(isNonNegativeNumber(3.14)).toBe(true);
    });

    it('should reject negative', () => {
      expect(isNonNegativeNumber(-0.01)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(isNonNegativeNumber(Infinity)).toBe(false);
    });
  });

  describe('isValidDateString', () => {
    it('should accept null', () => {
      expect(isValidDateString(null)).toBe(true);
    });

    it('should accept undefined', () => {
      expect(isValidDateString(undefined)).toBe(true);
    });

    it('should accept valid ISO dates', () => {
      expect(isValidDateString('2025-01-01T00:00:00.000Z')).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(isValidDateString('not-a-date')).toBe(false);
    });
  });

  describe('validateAccountData', () => {
    const validAccount = {
      steamId64: '76561198012345678',
      username: 'testuser',
      rank: 5,
      level: 10,
      hoursPlayed: 100.5,
      inventoryValue: 50.0,
      itemCount: 20,
      rareItemCount: 3,
      medalCount: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lastCheckedAt: null
    };

    it('should validate a correct account', () => {
      const result = validateAccountData(validAccount);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing steamId64', () => {
      const result = validateAccountData({ ...validAccount, steamId64: null });
      expect(result.valid).toBe(false);
    });

    it('should reject missing username', () => {
      const result = validateAccountData({ ...validAccount, username: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid rank', () => {
      const result = validateAccountData({ ...validAccount, rank: -1 });
      expect(result.valid).toBe(false);
    });
  });
});
