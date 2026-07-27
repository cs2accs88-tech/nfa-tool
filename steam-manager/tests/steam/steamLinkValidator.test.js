const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  validateProfileURL,
  validateSteamId64,
  isSafeToOpen,
  isIPAddress,
  isLocalhost
} = require('../../src/steam/steamLinkValidator');

describe('steamLinkValidator', () => {
  describe('validateSteamId64', () => {
    it('should validate a correct SteamID64', () => {
      const result = validateSteamId64('76561198012345678');
      assert.strictEqual(result.valid, true);
    });

    it('should reject empty string', () => {
      const result = validateSteamId64('');
      assert.strictEqual(result.valid, false);
    });

    it('should reject null', () => {
      const result = validateSteamId64(null);
      assert.strictEqual(result.valid, false);
    });

    it('should reject non-17-digit string', () => {
      const result = validateSteamId64('123456');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('17 digits'));
    });

    it('should reject SteamID64 out of range', () => {
      const result = validateSteamId64('10000000000000000');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('range'));
    });

    it('should accept the minimum valid SteamID64', () => {
      const result = validateSteamId64('76561197960265728');
      assert.strictEqual(result.valid, true);
    });
  });

  describe('validateProfileURL', () => {
    it('should validate a correct SteamID64 profile URL', () => {
      const result = validateProfileURL('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.type, 'steamid64');
      assert.strictEqual(result.identifier, '76561198012345678');
    });

    it('should validate a correct custom URL', () => {
      const result = validateProfileURL('https://steamcommunity.com/id/example');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.type, 'custom');
      assert.strictEqual(result.identifier, 'example');
    });

    it('should validate URL with trailing slash', () => {
      const result = validateProfileURL('https://steamcommunity.com/profiles/76561198012345678/');
      assert.strictEqual(result.valid, true);
    });

    it('should reject null', () => {
      const result = validateProfileURL(null);
      assert.strictEqual(result.valid, false);
    });

    it('should reject empty string', () => {
      const result = validateProfileURL('');
      assert.strictEqual(result.valid, false);
    });

    it('should reject javascript: protocol', () => {
      const result = validateProfileURL('javascript:alert(1)');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('Blocked protocol'));
    });

    it('should reject data: protocol', () => {
      const result = validateProfileURL('data:text/html,<h1>test</h1>');
      assert.strictEqual(result.valid, false);
    });

    it('should reject file: protocol', () => {
      const result = validateProfileURL('file:///etc/passwd');
      assert.strictEqual(result.valid, false);
    });

    it('should reject ftp: protocol', () => {
      const result = validateProfileURL('ftp://steamcommunity.com/profiles/123');
      assert.strictEqual(result.valid, false);
    });

    it('should reject HTTP (require HTTPS)', () => {
      const result = validateProfileURL('http://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('HTTPS'));
    });

    it('should reject localhost URLs', () => {
      const result = validateProfileURL('https://localhost/profiles/76561198012345678');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('Localhost'));
    });

    it('should reject IP address URLs', () => {
      const result = validateProfileURL('https://192.168.1.1/profiles/76561198012345678');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('IP address'));
    });

    it('should reject unknown domains', () => {
      const result = validateProfileURL('https://evil.com/profiles/76561198012345678');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('Invalid domain'));
    });

    it('should reject invalid path', () => {
      const result = validateProfileURL('https://steamcommunity.com/unknown/path');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('Invalid path'));
    });

    it('should reject invalid SteamID64 in URL', () => {
      const result = validateProfileURL('https://steamcommunity.com/profiles/123');
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('Invalid SteamID64'));
    });
  });

  describe('isSafeToOpen', () => {
    it('should allow valid Steam URLs', () => {
      const result = isSafeToOpen('https://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.safe, true);
    });

    it('should block javascript: URLs', () => {
      const result = isSafeToOpen('javascript:alert(1)');
      assert.strictEqual(result.safe, false);
    });

    it('should block localhost', () => {
      const result = isSafeToOpen('https://localhost/test');
      assert.strictEqual(result.safe, false);
    });

    it('should block IP addresses', () => {
      const result = isSafeToOpen('https://10.0.0.1/test');
      assert.strictEqual(result.safe, false);
    });

    it('should block non-Steam domains', () => {
      const result = isSafeToOpen('https://google.com');
      assert.strictEqual(result.safe, false);
    });

    it('should block non-HTTPS', () => {
      const result = isSafeToOpen('http://steamcommunity.com/profiles/76561198012345678');
      assert.strictEqual(result.safe, false);
    });
  });

  describe('isIPAddress', () => {
    it('should detect IPv4 addresses', () => {
      assert.strictEqual(isIPAddress('192.168.1.1'), true);
      assert.strictEqual(isIPAddress('10.0.0.1'), true);
    });

    it('should detect IPv6 addresses', () => {
      assert.strictEqual(isIPAddress('::1'), true);
    });

    it('should not flag normal hostnames', () => {
      assert.strictEqual(isIPAddress('steamcommunity.com'), false);
    });
  });

  describe('isLocalhost', () => {
    it('should detect localhost', () => {
      assert.strictEqual(isLocalhost('localhost'), true);
      assert.strictEqual(isLocalhost('127.0.0.1'), true);
    });

    it('should not flag normal hostnames', () => {
      assert.strictEqual(isLocalhost('steamcommunity.com'), false);
    });
  });
});
