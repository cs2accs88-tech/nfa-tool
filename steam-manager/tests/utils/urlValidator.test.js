const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  safeParseURL,
  isValidHttpsURL,
  isIPAddress,
  isLocalhostHost,
  hasDangerousProtocol,
  isSafeURL,
  escapeForDisplay
} = require('../../src/utils/urlValidator');

describe('urlValidator', () => {
  describe('safeParseURL', () => {
    it('should parse a valid URL', () => {
      const result = safeParseURL('https://example.com');
      assert.ok(result instanceof URL);
      assert.strictEqual(result.hostname, 'example.com');
    });

    it('should return null for invalid URL', () => {
      assert.strictEqual(safeParseURL('not-a-url'), null);
    });

    it('should return null for null', () => {
      assert.strictEqual(safeParseURL(null), null);
    });

    it('should trim whitespace', () => {
      const result = safeParseURL('  https://example.com  ');
      assert.ok(result instanceof URL);
    });
  });

  describe('isValidHttpsURL', () => {
    it('should return true for HTTPS URLs', () => {
      assert.strictEqual(isValidHttpsURL('https://example.com'), true);
    });

    it('should return false for HTTP URLs', () => {
      assert.strictEqual(isValidHttpsURL('http://example.com'), false);
    });

    it('should return false for invalid URLs', () => {
      assert.strictEqual(isValidHttpsURL('not-a-url'), false);
    });
  });

  describe('isIPAddress', () => {
    it('should detect IPv4', () => {
      assert.strictEqual(isIPAddress('192.168.1.1'), true);
      assert.strictEqual(isIPAddress('10.0.0.1'), true);
      assert.strictEqual(isIPAddress('255.255.255.255'), true);
    });

    it('should detect IPv6', () => {
      assert.strictEqual(isIPAddress('::1'), true);
      assert.strictEqual(isIPAddress('[::1]'), true);
    });

    it('should not flag hostnames', () => {
      assert.strictEqual(isIPAddress('example.com'), false);
      assert.strictEqual(isIPAddress('steamcommunity.com'), false);
    });
  });

  describe('isLocalhostHost', () => {
    it('should detect localhost variants', () => {
      assert.strictEqual(isLocalhostHost('localhost'), true);
      assert.strictEqual(isLocalhostHost('127.0.0.1'), true);
      assert.strictEqual(isLocalhostHost('0.0.0.0'), true);
      assert.strictEqual(isLocalhostHost('::1'), true);
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(isLocalhostHost('LOCALHOST'), true);
    });

    it('should not flag normal hosts', () => {
      assert.strictEqual(isLocalhostHost('example.com'), false);
    });
  });

  describe('hasDangerousProtocol', () => {
    it('should detect javascript:', () => {
      assert.strictEqual(hasDangerousProtocol('javascript:alert(1)'), true);
    });

    it('should detect data:', () => {
      assert.strictEqual(hasDangerousProtocol('data:text/html,test'), true);
    });

    it('should detect file:', () => {
      assert.strictEqual(hasDangerousProtocol('file:///etc/passwd'), true);
    });

    it('should detect ftp:', () => {
      assert.strictEqual(hasDangerousProtocol('ftp://server.com'), true);
    });

    it('should not flag https:', () => {
      assert.strictEqual(hasDangerousProtocol('https://example.com'), false);
    });

    it('should return true for null', () => {
      assert.strictEqual(hasDangerousProtocol(null), true);
    });
  });

  describe('isSafeURL', () => {
    it('should approve a valid HTTPS URL', () => {
      const result = isSafeURL('https://steamcommunity.com/profiles/123');
      assert.strictEqual(result.safe, true);
    });

    it('should reject HTTP when requireHttps is true', () => {
      const result = isSafeURL('http://example.com');
      assert.strictEqual(result.safe, false);
    });

    it('should allow HTTP when requireHttps is false', () => {
      const result = isSafeURL('http://example.com', { requireHttps: false });
      assert.strictEqual(result.safe, true);
    });

    it('should reject when domain not in allowedDomains', () => {
      const result = isSafeURL('https://evil.com', {
        allowedDomains: new Set(['steamcommunity.com'])
      });
      assert.strictEqual(result.safe, false);
    });

    it('should approve when domain is in allowedDomains', () => {
      const result = isSafeURL('https://steamcommunity.com/test', {
        allowedDomains: new Set(['steamcommunity.com'])
      });
      assert.strictEqual(result.safe, true);
    });

    it('should reject localhost', () => {
      const result = isSafeURL('https://localhost/test');
      assert.strictEqual(result.safe, false);
    });

    it('should reject IP addresses', () => {
      const result = isSafeURL('https://192.168.1.1/test');
      assert.strictEqual(result.safe, false);
    });
  });

  describe('escapeForDisplay', () => {
    it('should escape HTML special characters', () => {
      assert.strictEqual(escapeForDisplay('<script>'), '&lt;script&gt;');
      assert.strictEqual(escapeForDisplay('"hello"'), '&quot;hello&quot;');
      assert.strictEqual(escapeForDisplay("it's"), "it&#039;s");
      assert.strictEqual(escapeForDisplay('a & b'), 'a &amp; b');
    });

    it('should return empty string for null', () => {
      assert.strictEqual(escapeForDisplay(null), '');
    });

    it('should pass through safe text', () => {
      assert.strictEqual(escapeForDisplay('hello world'), 'hello world');
    });
  });
});
