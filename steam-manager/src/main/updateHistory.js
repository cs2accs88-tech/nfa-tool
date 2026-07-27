/**
 * @module main/updateHistory
 * @description Append-only, capped log of update lifecycle events (check found,
 * download completed, installed, failed, …) shown in the Updates UI.
 *
 * Persistence goes through an injectable key/value `store` so the capping/merge
 * logic is unit-testable without a database. In the app the default store is
 * {@link module:services/settingsService} (lazy-required, since it opens the DB
 * at module load).
 */

'use strict';

const STORE_KEY = 'updateHistory';
const MAX_ENTRIES = 50;

/**
 * @typedef {{ get:(key:string)=>(string|null), set:(key:string,value:string)=>void }} KvStore
 */

/**
 * Default store backed by the settings table. Lazy-required so that merely
 * importing this module never forces the database open (keeps it testable).
 * @returns {KvStore}
 */
function defaultStore() {
  const { getSetting, saveSetting } = require('../services/settingsService');
  return {
    get: (key) => {
      const res = getSetting(key);
      return res && res.success ? res.value : null;
    },
    set: (key, value) => { saveSetting(key, value); }
  };
}

/**
 * Pure helper: appends `entry` to `list` and trims to the newest `max` items.
 * Newest entries are kept at the end.
 * @param {object[]} list
 * @param {object} entry
 * @param {number} [max=MAX_ENTRIES]
 * @returns {object[]}
 */
function appendCapped(list, entry, max = MAX_ENTRIES) {
  const next = Array.isArray(list) ? list.slice() : [];
  next.push(entry);
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Safely parses the stored JSON array.
 * @param {string|null} raw
 * @returns {object[]}
 */
function parseList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Records an update event. Never throws (history is best-effort).
 * @param {string} event - short event key (e.g. 'update-downloaded')
 * @param {object} [detail] - { version?, message?, level? }
 * @param {{ store?:KvStore }} [opts]
 * @returns {object|null} the stored entry, or null on failure
 */
function recordEvent(event, detail = {}, opts = {}) {
  try {
    const store = opts.store || defaultStore();
    const entry = {
      event: String(event),
      version: detail.version != null ? String(detail.version) : null,
      message: detail.message != null ? String(detail.message) : null,
      level: detail.level || 'info',
      at: new Date().toISOString()
    };
    const list = appendCapped(parseList(store.get(STORE_KEY)), entry);
    store.set(STORE_KEY, JSON.stringify(list));
    return entry;
  } catch {
    return null;
  }
}

/**
 * Lists recorded events, newest first.
 * @param {{ store?:KvStore, limit?:number }} [opts]
 * @returns {object[]}
 */
function listHistory(opts = {}) {
  try {
    const store = opts.store || defaultStore();
    const list = parseList(store.get(STORE_KEY)).slice().reverse();
    return opts.limit ? list.slice(0, opts.limit) : list;
  } catch {
    return [];
  }
}

module.exports = { recordEvent, listHistory, appendCapped, STORE_KEY, MAX_ENTRIES };
