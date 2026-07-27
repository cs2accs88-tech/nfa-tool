'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const settings = require('../../../src/main/updateSettings');

function memStore() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) };
}

test('mergeSettings precedence: patch > persisted > base', () => {
  const base = { autoCheck: true, autoDownload: false, notifyBeforeInstall: true };
  const persisted = { autoDownload: true };
  const patch = { notifyBeforeInstall: false };
  const merged = settings.mergeSettings(base, persisted, patch);
  assert.deepStrictEqual(merged, { autoCheck: true, autoDownload: true, notifyBeforeInstall: false });
});

test('mergeSettings ignores non-boolean and unknown keys', () => {
  const base = { autoCheck: true, autoDownload: false, notifyBeforeInstall: true };
  const merged = settings.mergeSettings(base, { autoDownload: 'yes', hacker: 1 }, { autoCheck: 'nope' });
  assert.deepStrictEqual(merged, base);
  assert.strictEqual('hacker' in merged, false);
});

test('getUpdateSettings returns defaults when nothing persisted', () => {
  const store = memStore();
  const s = settings.getUpdateSettings({ store });
  assert.strictEqual(typeof s.autoCheck, 'boolean');
  assert.strictEqual(typeof s.autoDownload, 'boolean');
  assert.strictEqual(s.notifyBeforeInstall, true);
});

test('setUpdateSettings persists merged result and getUpdateSettings reads it back', () => {
  const store = memStore();
  const saved = settings.setUpdateSettings({ autoDownload: true, notifyBeforeInstall: false }, { store });
  assert.strictEqual(saved.autoDownload, true);
  assert.strictEqual(saved.notifyBeforeInstall, false);

  const read = settings.getUpdateSettings({ store });
  assert.strictEqual(read.autoDownload, true);
  assert.strictEqual(read.notifyBeforeInstall, false);
});

test('setUpdateSettings tolerates corrupted persisted value', () => {
  const store = memStore();
  store.set(settings.STORE_KEY, 'garbage{');
  const saved = settings.setUpdateSettings({ autoCheck: false }, { store });
  assert.strictEqual(saved.autoCheck, false);
});
