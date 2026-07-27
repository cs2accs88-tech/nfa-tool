'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const fmt = require('../../../src/main/updateFormat');

test('compareSemver: core ordering', () => {
  assert.strictEqual(fmt.compareSemver('1.2.3', '1.2.3'), 0);
  assert.strictEqual(fmt.compareSemver('1.2.4', '1.2.3'), 1);
  assert.strictEqual(fmt.compareSemver('1.3.0', '1.2.9'), 1);
  assert.strictEqual(fmt.compareSemver('2.0.0', '1.9.9'), 1);
  assert.strictEqual(fmt.compareSemver('1.0.0', '1.0.1'), -1);
});

test('compareSemver: tolerates leading v and missing parts', () => {
  assert.strictEqual(fmt.compareSemver('v1.2.0', '1.2.0'), 0);
  assert.strictEqual(fmt.compareSemver('1.2', '1.2.0'), 0);
  assert.strictEqual(fmt.compareSemver('v2', '1.9.9'), 1);
});

test('compareSemver: release outranks prerelease of same core', () => {
  assert.strictEqual(fmt.compareSemver('1.0.0', '1.0.0-beta'), 1);
  assert.strictEqual(fmt.compareSemver('1.0.0-alpha', '1.0.0-beta'), -1);
});

test('isNewerVersion', () => {
  assert.strictEqual(fmt.isNewerVersion('1.2.4', '1.2.3'), true);
  assert.strictEqual(fmt.isNewerVersion('1.2.3', '1.2.3'), false);
  assert.strictEqual(fmt.isNewerVersion('1.0.0', '1.0.1'), false);
});

test('formatBytes', () => {
  assert.strictEqual(fmt.formatBytes(0), '0 B');
  assert.strictEqual(fmt.formatBytes(512), '512 B');
  assert.strictEqual(fmt.formatBytes(1024), '1.0 KB');
  assert.strictEqual(fmt.formatBytes(1536), '1.5 KB');
  assert.strictEqual(fmt.formatBytes(1048576), '1.0 MB');
});

test('formatSpeed', () => {
  assert.strictEqual(fmt.formatSpeed(0), '0 B/s');
  assert.strictEqual(fmt.formatSpeed(1048576), '1.0 MB/s');
});

test('etaMs', () => {
  assert.strictEqual(fmt.etaMs(1000, 0, 100), 10000);
  assert.strictEqual(fmt.etaMs(1000, 500, 100), 5000);
  assert.strictEqual(fmt.etaMs(1000, 0, 0), null); // no speed
  assert.strictEqual(fmt.etaMs(1000, 1200, 100), 0); // already done
});

test('formatEta', () => {
  assert.strictEqual(fmt.formatEta(null), 'calculating…');
  assert.strictEqual(fmt.formatEta(5000), '5s');
  assert.strictEqual(fmt.formatEta(65000), '1m 05s');
});

test('normalizeProgress produces UI-ready fields', () => {
  const p = fmt.normalizeProgress({ percent: 42.6, transferred: 4200, total: 10000, bytesPerSecond: 2000 });
  assert.strictEqual(p.percent, 43);
  assert.strictEqual(p.totalText, '9.8 KB');
  assert.strictEqual(p.speedText, '2.0 KB/s');
  assert.strictEqual(typeof p.etaText, 'string');
  assert.ok(p.etaMs >= 0);
});

test('normalizeProgress clamps + tolerates missing fields', () => {
  const p = fmt.normalizeProgress({});
  assert.strictEqual(p.percent, 0);
  assert.strictEqual(p.total, 0);
  assert.strictEqual(p.etaMs, null);
});
