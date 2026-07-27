/**
 * @module main/updateController
 * @description IPC bridge for the auto-update system. Gives the renderer
 * read access to update state/history/settings and the ability to trigger a
 * check, download, install, or settings change.
 *
 * Channels:
 *  - `update:check`       ()          -> checkForUpdates result
 *  - `update:download`    ()          -> { success }
 *  - `update:install`     ()          -> { success } (quits + installs)
 *  - `update:getState`    ()          -> current state + version + settings
 *  - `update:getHistory`  (limit?)    -> recent update events (newest first)
 *  - `update:getSettings` ()          -> effective update settings
 *  - `update:setSettings` (patch)     -> merged settings (applied live)
 *
 * @dependencies updateService, updateSettings, updateHistory
 */

'use strict';

const updateService = require('./updateService');
const updateSettings = require('./updateSettings');
const updateHistory = require('./updateHistory');

/**
 * Registers IPC handlers for update operations.
 * @param {Electron.IpcMain} ipcMain
 */
function registerUpdateHandlers(ipcMain) {
  ipcMain.handle('update:check', async () => updateService.checkForUpdates());

  ipcMain.handle('update:download', async () => updateService.downloadUpdate());

  ipcMain.handle('update:install', () => updateService.installUpdate());

  ipcMain.handle('update:getState', () => {
    try {
      return { success: true, state: updateService.getState() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update:getHistory', (_event, limit) => {
    try {
      return { success: true, history: updateHistory.listHistory({ limit: Number(limit) || 50 }) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update:getSettings', () => {
    try {
      return { success: true, settings: updateSettings.getUpdateSettings() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update:setSettings', (_event, patch) => {
    try {
      const settings = updateSettings.setUpdateSettings(patch || {});
      // Apply live: refresh auto-download flag and (re)start or stop periodic
      // checks to match the new auto-check preference.
      updateService.applySettings();
      if (settings.autoCheck) updateService.startPeriodicChecks();
      else updateService.stopPeriodicChecks();
      return { success: true, settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerUpdateHandlers };
