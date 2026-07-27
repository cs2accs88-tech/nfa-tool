/**
 * @module profileIpcHandlers
 * @description IPC handlers for Steam profile link operations.
 * Registers Electron IPC handlers that the renderer process
 * can invoke for profile link management.
 *
 * @dependencies ../controllers/profileController
 *
 * @example
 * const { registerProfileHandlers } = require('./profileIpcHandlers');
 * registerProfileHandlers(ipcMain);
 */

const profileController = require('../controllers/profileController');

/**
 * IPC channel names for profile operations.
 */
const CHANNELS = Object.freeze({
  GENERATE: 'profile:generate',
  VALIDATE: 'profile:validate',
  UPDATE: 'profile:update',
  DELETE: 'profile:delete',
  OPEN: 'profile:open',
  COPY: 'profile:copy',
  GET: 'profile:get',
  HISTORY: 'profile:history',
  EXTRACT_ID: 'profile:extractId',
  RESOLVE: 'profile:resolve',
  BATCH_GENERATE: 'profile:batchGenerate'
});

/**
 * Registers all profile link IPC handlers on the given ipcMain instance.
 * Each handler wraps the corresponding controller method and handles errors.
 *
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance.
 */
function registerProfileHandlers(ipcMain) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('Valid ipcMain instance with handle method is required');
  }

  ipcMain.handle(CHANNELS.GENERATE, async (_event, accountId) => {
    try {
      return profileController.generateProfileLink(accountId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.VALIDATE, async (_event, accountId) => {
    try {
      return profileController.validateProfileLink(accountId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.UPDATE, async (_event, accountId, updates) => {
    try {
      return profileController.updateProfileLink(accountId, updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.DELETE, async (_event, accountId) => {
    try {
      return profileController.deleteProfileLink(accountId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.OPEN, async (_event, accountId) => {
    try {
      const result = profileController.openProfileLink(accountId);
      if (result.success && result.url) {
        // In Electron, use shell.openExternal to open the URL
        const { shell } = require('electron');
        await shell.openExternal(result.url);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.COPY, async (_event, accountId) => {
    try {
      const result = profileController.copyProfileLink(accountId);
      if (result.success && result.text) {
        const { clipboard } = require('electron');
        clipboard.writeText(result.text);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.GET, async (_event, accountId) => {
    try {
      return profileController.getProfileLink(accountId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.HISTORY, async (_event, accountId, options) => {
    try {
      return profileController.getProfileHistory(accountId, options);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.EXTRACT_ID, async (_event, input) => {
    try {
      return profileController.extractSteamId(input);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.RESOLVE, async (_event, input, options) => {
    try {
      return profileController.resolveProfile(input, options);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.BATCH_GENERATE, async (_event) => {
    try {
      return profileController.batchGenerateLinks();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerProfileHandlers,
  CHANNELS
};
