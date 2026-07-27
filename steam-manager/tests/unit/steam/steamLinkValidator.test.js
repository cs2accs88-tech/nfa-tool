import { describe, it, expect } from 'vitest';
const {
  validateProfileURL,
  validateSteamId64,
  isSafeToOpen,
  isIPAddress,
  isLocalhost
} = require('../../../src/steam/steamLinkValidator');

describe('steamLinkValidator', () => {
  describe('validateSteamId64', () => {
    it('should validate a correct SteamID64', () => {
      expect(validateSteamId64('76561198012345678').valid).toBe(true);
    });

    it('should reject empty string', () => {
      expect(validateSteamId64('').valid).toBe(false);
    });

    it('should reject null', () => {
      expect(validateSteamId64(null).valid).toBe(false);
    });

    it('should reject non-17-digit string', () => {
      const result = validateSteamId64('123456');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('17 digits');
    });

    it('should reject SteamID64 out of range', () => {
      const result = validateSteamId64('10000000000000000');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateProfileURL', () => {
    it('should validate a correct SteamID64 profile URL', () => {
      const result = validateProfileURL('https://steamcommunity.com/profiles/76561198012345678');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('steamid64');
      expect(result.identifier).toBe('76561198012345678');
    });

    it('should validate a correct custom URL', () => {
      const result = validateProfileURL('https://steamcommunity.com/id/example');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('custom');
      expect(result.identifier).toBe('example');
    });

    it('should validate URL with trailing slash', () => {
      const result = validateProfileURL('https://steamcommunity.com/profiles/76561198012345678/');
      expect(result.valid).toBe(true);
    });

    it('should reject null', () => {
      expect(validateProfileURL(null).valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateProfileURL('').valid).toBe(false);
    });

    it('should reject javascript: protocol', () => {
      const result = validateProfileURL('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Blocked protocol');
    });

    it('should reject data: protocol', () => {
      expect(validateProfileURL('data:text/html,test').valid).toBe(false);
    });

    it('should reject file: protocol', () => {
      expect(validateProfileURL('file:///etc/passwd').valid).toBe(false);
    });

    it('should reject ftp: protocol', () => {
      expect(validateProfileURL('ftp://steamcommunity.com/profiles/123').valid).toBe(false);
    });

    it('should reject HTTP (require HTTPS)', () => {
      const result = validateProfileURL('http://steamcommunity.com/profiles/76561198012345678');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });

    it('should reject localhost URLs', () => {
      const result = validateProfileURL('https://localhost/profiles/76561198012345678');
      expect(result.valid).toBe(false);
    });

    it('should reject IP address URLs', () => {
      const result = validateProfileURL('https://192.168.1.1/profiles/76561198012345678');
      expect(result.valid).toBe(false);
    });

    it('should reject unknown domains', () => {
      const result = validateProfileURL('https://evil.com/profiles/76561198012345678');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid domain');
    });

    it('should reject invalid path', () => {
      const result = validateProfileURL('https://steamcommunity.com/unknown/path');
      expect(result.valid).toBe(false);
    });
  });

  describe('isSafeToOpen', () => {
    it('should allow valid Steam URLs', () => {
      expect(isSafeToOpen('https://steamcommunity.com/profiles/76561198012345678').safe).toBe(true);
    });

    it('should block javascript: URLs', () => {
      expect(isSafeToOpen('javascript:alert(1)').safe).toBe(false);
    });

    it('should block localhost', () => {
      expect(isSafeToOpen('https://localhost/test').safe).toBe(false);
    });

    it('should block IP addresses', () => {
      expect(isSafeToOpen('https://10.0.0.1/test').safe).toBe(false);
    });

    it('should block non-Steam domains', () => {
      expect(isSafeToOpen('https://google.com').safe).toBe(false);
    });
  });

  describe('isIPAddress', () => {
    it('should detect IPv4 addresses', () => {
      expect(isIPAddress('192.168.1.1')).toBe(true);
    });

    it('should detect IPv6 addresses', () => {
      expect(isIPAddress('::1')).toBe(true);
    });

    it('should not flag normal hostnames', () => {
      expect(isIPAddress('steamcommunity.com')).toBe(false);
    });
  });

  describe('isLocalhost', () => {
    it('should detect localhost', () => {
      expect(isLocalhost('localhost')).toBe(true);
      expect(isLocalhost('127.0.0.1')).toBe(true);
    });

    it('should not flag normal hostnames', () => {
      expect(isLocalhost('steamcommunity.com')).toBe(false);
    });
  });
});
