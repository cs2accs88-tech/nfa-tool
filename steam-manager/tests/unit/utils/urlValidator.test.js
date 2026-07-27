import { describe, it, expect } from 'vitest';
const {
  safeParseURL,
  isValidHttpsURL,
  isIPAddress,
  isLocalhostHost,
  hasDangerousProtocol,
  isSafeURL,
  escapeForDisplay
} = require('../../../src/utils/urlValidator');

describe('urlValidator', () => {
  describe('safeParseURL', () => {
    it('should parse a valid URL', () => {
      const result = safeParseURL('https://example.com');
      expect(result).toBeInstanceOf(URL);
      expect(result.hostname).toBe('example.com');
    });

    it('should return null for invalid URL', () => {
      expect(safeParseURL('not-a-url')).toBeNull();
    });

    it('should return null for null', () => {
      expect(safeParseURL(null)).toBeNull();
    });

    it('should trim whitespace', () => {
      const result = safeParseURL('  https://example.com  ');
      expect(result).toBeInstanceOf(URL);
    });
  });

  describe('isValidHttpsURL', () => {
    it('should return true for HTTPS URLs', () => {
      expect(isValidHttpsURL('https://example.com')).toBe(true);
    });

    it('should return false for HTTP URLs', () => {
      expect(isValidHttpsURL('http://example.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidHttpsURL('not-a-url')).toBe(false);
    });
  });

  describe('isIPAddress', () => {
    it('should detect IPv4', () => {
      expect(isIPAddress('192.168.1.1')).toBe(true);
      expect(isIPAddress('10.0.0.1')).toBe(true);
    });

    it('should detect IPv6', () => {
      expect(isIPAddress('::1')).toBe(true);
    });

    it('should not flag hostnames', () => {
      expect(isIPAddress('example.com')).toBe(false);
    });
  });

  describe('isLocalhostHost', () => {
    it('should detect localhost variants', () => {
      expect(isLocalhostHost('localhost')).toBe(true);
      expect(isLocalhostHost('127.0.0.1')).toBe(true);
      expect(isLocalhostHost('0.0.0.0')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isLocalhostHost('LOCALHOST')).toBe(true);
    });

    it('should not flag normal hosts', () => {
      expect(isLocalhostHost('example.com')).toBe(false);
    });
  });

  describe('hasDangerousProtocol', () => {
    it('should detect javascript:', () => {
      expect(hasDangerousProtocol('javascript:alert(1)')).toBe(true);
    });

    it('should detect data:', () => {
      expect(hasDangerousProtocol('data:text/html,test')).toBe(true);
    });

    it('should detect file:', () => {
      expect(hasDangerousProtocol('file:///etc/passwd')).toBe(true);
    });

    it('should not flag https:', () => {
      expect(hasDangerousProtocol('https://example.com')).toBe(false);
    });

    it('should return true for null', () => {
      expect(hasDangerousProtocol(null)).toBe(true);
    });
  });

  describe('isSafeURL', () => {
    it('should approve a valid HTTPS URL', () => {
      expect(isSafeURL('https://steamcommunity.com/profiles/123').safe).toBe(true);
    });

    it('should reject HTTP when requireHttps is true', () => {
      expect(isSafeURL('http://example.com').safe).toBe(false);
    });

    it('should allow HTTP when requireHttps is false', () => {
      expect(isSafeURL('http://example.com', { requireHttps: false }).safe).toBe(true);
    });

    it('should reject when domain not in allowedDomains', () => {
      const result = isSafeURL('https://evil.com', { allowedDomains: new Set(['steamcommunity.com']) });
      expect(result.safe).toBe(false);
    });

    it('should reject localhost', () => {
      expect(isSafeURL('https://localhost/test').safe).toBe(false);
    });

    it('should reject IP addresses', () => {
      expect(isSafeURL('https://192.168.1.1/test').safe).toBe(false);
    });
  });

  describe('escapeForDisplay', () => {
    it('should escape HTML special characters', () => {
      expect(escapeForDisplay('<script>')).toBe('&lt;script&gt;');
      expect(escapeForDisplay('"hello"')).toBe('&quot;hello&quot;');
      expect(escapeForDisplay('a & b')).toBe('a &amp; b');
    });

    it('should return empty string for null', () => {
      expect(escapeForDisplay(null)).toBe('');
    });

    it('should pass through safe text', () => {
      expect(escapeForDisplay('hello world')).toBe('hello world');
    });
  });
});
