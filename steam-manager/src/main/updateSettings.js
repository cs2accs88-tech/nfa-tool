/**
 * @module main/updateSettings
 * @description User-configurable update preferences, layered on top of the
 * build defaults in {@link module:config/production}:
 *   - `autoCheck`            — check for updates automatically (startup + interval)
 *   - `autoDownload`         — download an available update without asking
 *   - `notifyBeforeInstall`  — prompt before installing a downloaded update
 *
 * Overrides persist through an injectable key/value `store` (default:
 * {@link module:services/settingsService}, lazy-required). The merge logic is
 * pure and unit-tested.
 */

'use strict';

const STORE_KEY = 'updateSettings';

/**
 * Build-time defaults derived from production config.
 * @returns {{ autoCheck:boolean, autoDownload:boolean, notifyBeforeInstall:boolean }}
 */
function defaults() {
  let cfg = { enabled: false, autoDownload: false };
  try {
    cfg = require('../config/production').update || cfg;
  } catch { /* config unavailable in some test contexts */ }
  return {
    autoCheck: !!cfg.enabled,
    autoDownload: !!cfg.autoDownload,
    notifyBeforeInstall: true
  };
}

/**
 * Lazy settings-table store.
 * @returns {{ get:(k:string)=>(string|null), set:(k:string,v:string)=>void }}
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
 * Pure merge: base defaults ← persisted overrides ← patch. Only known boolean
 * keys are honored, so callers can't inject arbitrary settings.
 * @param {object} base
 * @param {object} persisted
 * @param {object} patch
 * @returns {{ autoCheck:boolean, autoDownload:boolean, notifyBeforeInstall:boolean }}
 */
function mergeSettings(base, persisted, patch) {
  const out = { ...base };
  for (const key of ['autoCheck', 'autoDownload', 'notifyBeforeInstall']) {
    if (persisted && typeof persisted[key] === 'boolean') out[key] = persisted[key];
    if (patch && typeof patch[key] === 'boolean') out[key] = patch[key];
  }
  return out;
}

/**
 * @param {string|null} raw
 * @returns {object}
 */
function parseObj(raw) {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/**
 * Returns the effective update settings (defaults + persisted overrides).
 * @param {{ store?:object }} [opts]
 * @returns {object}
 */
function getUpdateSettings(opts = {}) {
  const store = opts.store || defaultStore();
  return mergeSettings(defaults(), parseObj(store.get(STORE_KEY)), null);
}

/**
 * Applies a partial update to the settings and persists the merged result.
 * @param {object} patch
 * @param {{ store?:object }} [opts]
 * @returns {object} the merged settings
 */
function setUpdateSettings(patch, opts = {}) {
  const store = opts.store || defaultStore();
  const merged = mergeSettings(defaults(), parseObj(store.get(STORE_KEY)), patch || {});
  store.set(STORE_KEY, JSON.stringify(merged));
  return merged;
}

module.exports = { getUpdateSettings, setUpdateSettings, mergeSettings, defaults, STORE_KEY };
