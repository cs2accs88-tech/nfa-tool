'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const history = require('../../../src/main/updateHistory');

/** In-memory KV store for injecting into the history functions. */
function memStore() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) };
}

test('appendCapped keeps newest N', () => {
  let list = [];
  for (let i = 1; i <= 5; i += 1) list = history.appendCapped(list, { n: i }, 3);
  assert.deepStrictEqual(list.map((x) => x.n), [3, 4, 5]);
});

test('recordEvent + listHistory round-trip (newest first)', () => {
  const store = memStore();
  history.recordEvent('check-started', { message: 'a' }, { store });
  history.recordEvent('update-available', { version: '1.2.0', message: 'b' }, { store });

  const list = history.listHistory({ store });
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].event, 'update-available'); // newest first
  assert.strictEqual(list[0].version, '1.2.0');
  assert.strictEqual(list[1].event, 'check-started');
  assert.ok(list[0].at); // timestamp present
});

test('listHistory honors limit', () => {
  const store = memStore();
  for (let i = 0; i < 10; i += 1) history.recordEvent('e' + i, {}, { store });
  const list = history.listHistory({ store, limit: 3 });
  assert.strictEqual(list.length, 3);
  assert.strictEqual(list[0].event, 'e9');
});

test('recordEvent caps stored entries to MAX_ENTRIES', () => {
  const store = memStore();
  for (let i = 0; i < history.MAX_ENTRIES + 20; i += 1) history.recordEvent('e' + i, {}, { store });
  const raw = JSON.parse(store.get(history.STORE_KEY));
  assert.strictEqual(raw.length, history.MAX_ENTRIES);
});

test('listHistory tolerates corrupted stored value', () => {
  const store = memStore();
  store.set(history.STORE_KEY, '{not json');
  assert.deepStrictEqual(history.listHistory({ store }), []);
});

test('recordEvent never throws on a broken store', () => {
  const brokenStore = { get: () => { throw new Error('boom'); }, set: () => {} };
  assert.strictEqual(history.recordEvent('x', {}, { store: brokenStore }), null);
});
