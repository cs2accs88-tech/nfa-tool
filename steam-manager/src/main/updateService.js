/**
 * @module main/updateService
 * @description Auto-update service built on electron-updater.
 *
 * Responsibilities:
 *  - initialize the updater (production only; degrades gracefully otherwise),
 *  - check / download / install updates,
 *  - forward normalized lifecycle events to the renderer (`update:status`),
 *  - honor the user's {@link module:main/updateSettings} (auto-check,
 *    auto-download, notify-before-install),
 *  - record events to {@link module:main/updateHistory},
 *  - expose the latest state for a freshly-opened UI ({@link getState}).
 *
 * Security/verification is delegated to electron-updater, which verifies the
 * package's sha512 (from the publisher's `latest.yml`) before installing and
 * aborts on mismatch — so a corrupted or tampered download is never installed,
 * and the current version stays intact.
 *
 * @dependencies electron-updater (optional at runtime), updateConfig,
 * updateSettings, updateHistory, updateFormat, productionLogger
 */

'use strict';

const updateConfig = require('./updateConfig');
const updateSettings = require('./updateSettings');
const updateHistory = require('./updateHistory');
const { normalizeProgress } = require('./updateFormat');
const { createProductionLogger } = require('./productionLogger');

const logger = createProductionLogger('updater');

let autoUpdater = null;
let updateCheckInterval = null;
let getWindow = () => null;

/** Guards against overlapping check/download operations. */
let busy = false;

/**
 * The most recent status pushed to the renderer, so a UI that opens mid-cycle
 * (or after the check already ran) can show the current state immediately.
 * @type {object}
 */
let lastState = { state: 'idle' };

/**
 * Returns the running app version (falls back to package.json under tests).
 * @returns {string}
 */
function currentVersion() {
  try {
    return require('electron').app.getVersion();
  } catch {
    try { return require('../../package.json').version; } catch { return '0.0.0'; }
  }
}

/**
 * Normalizes electron-updater's `releaseNotes` (string | array | null) to a
 * plain string for display.
 * @param {*} notes
 * @returns {string|null}
 */
function normalizeReleaseNotes(notes) {
  if (!notes) return null;
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) {
    return notes.map((n) => (n && n.note ? `v${n.version || ''}\n${n.note}` : String(n))).join('\n\n');
  }
  return String(notes);
}

/**
 * Pushes a status update to the renderer and remembers it as {@link lastState}.
 * @param {string} state
 * @param {object} [extra]
 */
function emit(state, extra = {}) {
  lastState = { state, at: new Date().toISOString(), ...extra };
  try {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('update:status', lastState);
  } catch { /* renderer notification is best-effort */ }
}

/**
 * Initializes the auto-updater. Only loads electron-updater in production
 * builds (the dependency + generated feed are not present in dev).
 * @param {() => (Electron.BrowserWindow|null)} [windowGetter]
 * @returns {boolean} whether initialization succeeded
 */
function initialize(windowGetter) {
  if (typeof windowGetter === 'function') getWindow = windowGetter;

  if (!updateConfig.enabled) {
    logger.info('Auto-update disabled (non-production build)');
    emit('disabled', { currentVersion: currentVersion() });
    return false;
  }

  try {
    const { autoUpdater: updater } = require('electron-updater');
    autoUpdater = updater;

    const settings = updateSettings.getUpdateSettings();
    autoUpdater.autoDownload = settings.autoDownload;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = updateConfig.allowPrerelease;
    autoUpdater.logger = logger;

    registerEvents();
    logger.info('Auto-updater initialized');
    emit('idle', { currentVersion: currentVersion() });
    return true;
  } catch (error) {
    // electron-updater absent (e.g. not installed / dev) — non-fatal.
    logger.warn('Auto-updater not available:', error.message);
    emit('unavailable', { currentVersion: currentVersion(), message: error.message });
    return false;
  }
}

/**
 * Registers electron-updater event handlers, forwarding normalized payloads to
 * the renderer and recording history.
 */
function registerEvents() {
  if (!autoUpdater) return;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
    emit('checking', { currentVersion: currentVersion() });
  });

  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: v${info.version}`);
    updateHistory.recordEvent('update-available', { version: info.version, message: 'Update found' });
    emit('available', {
      currentVersion: currentVersion(),
      version: info.version,
      releaseDate: info.releaseDate || null,
      releaseName: info.releaseName || null,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      autoDownload: !!autoUpdater.autoDownload
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('Application is up to date');
    emit('not-available', { currentVersion: currentVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    emit('downloading', { currentVersion: currentVersion(), progress: normalizeProgress(progress) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`Update downloaded: v${info.version}`);
    updateHistory.recordEvent('update-downloaded', { version: info.version, message: 'Download complete, verified' });
    emit('downloaded', { currentVersion: currentVersion(), version: info.version });

    // Auto-install only when the user has opted out of the confirmation prompt.
    const settings = updateSettings.getUpdateSettings();
    if (!settings.notifyBeforeInstall) {
      logger.info('notifyBeforeInstall is off — installing now');
      installUpdate();
    }
  });

  autoUpdater.on('error', (error) => {
    const message = (error && error.message) || String(error);
    logger.error('Update error:', message);
    updateHistory.recordEvent('error', { message, level: 'error' });
    emit('error', { currentVersion: currentVersion(), message });
  });
}

/**
 * Checks for available updates. Safe to call manually (from the UI).
 * @returns {Promise<object>}
 */
async function checkForUpdates() {
  if (!autoUpdater) {
    return { available: false, reason: 'Updater not available in this build', currentVersion: currentVersion() };
  }
  if (busy) return { available: false, reason: 'An update operation is already in progress' };
  busy = true;
  updateHistory.recordEvent('check-started', { message: 'Checking for updates' });
  try {
    const result = await autoUpdater.checkForUpdates();
    const info = result && result.updateInfo;
    return {
      available: !!info,
      currentVersion: currentVersion(),
      version: info ? info.version : null,
      releaseDate: info ? info.releaseDate || null : null,
      releaseNotes: info ? normalizeReleaseNotes(info.releaseNotes) : null
    };
  } catch (error) {
    logger.error('Check for updates failed:', error.message);
    emit('error', { currentVersion: currentVersion(), message: error.message });
    return { available: false, error: error.message };
  } finally {
    busy = false;
  }
}

/**
 * Downloads an available update.
 * @returns {Promise<{ success:boolean, error?:string }>}
 */
async function downloadUpdate() {
  if (!autoUpdater) return { success: false, error: 'Updater not available in this build' };
  if (busy) return { success: false, error: 'An update operation is already in progress' };
  busy = true;
  updateHistory.recordEvent('download-started', { message: 'Download started' });
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    logger.error('Download update failed:', error.message);
    emit('error', { currentVersion: currentVersion(), message: error.message });
    return { success: false, error: error.message };
  } finally {
    busy = false;
  }
}

/**
 * Installs a downloaded update and restarts. `quitAndInstall(false, true)`
 * keeps this silent-ish and forces a relaunch. User data lives in `userData`,
 * which the NSIS installer preserves.
 * @returns {{ success:boolean, error?:string }}
 */
function installUpdate() {
  if (!autoUpdater) return { success: false, error: 'Updater not available in this build' };
  try {
    updateHistory.recordEvent('installing', { message: 'Installing update and restarting' });
    emit('installing', { currentVersion: currentVersion() });
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    logger.error('Install update failed:', error.message);
    emit('error', { currentVersion: currentVersion(), message: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Re-reads settings and applies the live auto-download flag.
 * @returns {object} the effective settings
 */
function applySettings() {
  const settings = updateSettings.getUpdateSettings();
  if (autoUpdater) autoUpdater.autoDownload = settings.autoDownload;
  return settings;
}

/**
 * Starts periodic background checks when auto-check is enabled. An initial
 * check runs shortly after startup so a waiting update surfaces quickly.
 */
function startPeriodicChecks() {
  if (!autoUpdater) return;
  const settings = updateSettings.getUpdateSettings();
  if (!settings.autoCheck) {
    logger.info('Automatic update checks are disabled by the user');
    return;
  }
  if (updateCheckInterval) clearInterval(updateCheckInterval);
  updateCheckInterval = setInterval(() => { checkForUpdates(); }, updateConfig.checkInterval);
  setTimeout(() => { checkForUpdates(); }, 30000);
}

/** Stops periodic background checks. */
function stopPeriodicChecks() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

/**
 * Returns the current update state for a freshly-opened UI, including the
 * running version and effective settings.
 * @returns {object}
 */
function getState() {
  let settings;
  try { settings = updateSettings.getUpdateSettings(); } catch { settings = null; }
  return {
    ...lastState,
    currentVersion: currentVersion(),
    enabled: !!updateConfig.enabled,
    available: !!autoUpdater,
    settings
  };
}

module.exports = {
  initialize,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  startPeriodicChecks,
  stopPeriodicChecks,
  applySettings,
  getState,
  // Exposed for testing.
  _internals: { normalizeReleaseNotes }
};
