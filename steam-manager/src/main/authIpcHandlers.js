/**
 * @module main/authIpcHandlers
 * @description IPC handlers for the local Steam client sign-in ("injection").
 *
 * Channels:
 *  - `steam:loginClient`    (accountId) -> prepares Steam + restarts it signed
 *                                          in as the account (purely local).
 *  - `steam:getActiveClient`()          -> the account most recently injected.
 *
 * Handlers never throw to the renderer: the service already returns structured
 * `{ success, ... }` results, and any unexpected error is caught, logged and
 * reported as a plain message (never a stack trace).
 */

'use strict';

const { createProductionLogger } = require('./productionLogger');

const logger = createProductionLogger('authIpc');

/**
 * Registers the Steam client sign-in IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 */
function registerAuthHandlers(ipcMain) {
  ipcMain.handle('steam:loginClient', async (_event, accountId) => {
    const id = Number(accountId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: 'Invalid account selection.' };
    }
    try {
      const { loginToClient } = require('./steamClientLoginService');
      return await loginToClient(id);
    } catch (err) {
      logger.error('steam:loginClient crashed', err.message);
      return { success: false, error: 'Steam sign-in failed unexpectedly.' };
    }
  });

  ipcMain.handle('steam:getActiveClient', async () => {
    try {
      const { getActiveClient } = require('./steamClientLoginService');
      return getActiveClient();
    } catch (err) {
      logger.warn('steam:getActiveClient failed', err.message);
      return { success: true, active: null };
    }
  });
}

module.exports = { registerAuthHandlers };
