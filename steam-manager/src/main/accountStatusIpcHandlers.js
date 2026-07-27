/**
 * @module main/accountStatusIpcHandlers
 * @description IPC handlers for the Account Status tab.
 *
 * Channels:
 *  - `status:list`       ()  -> instant local status of every account
 *  - `status:summary`    ()  -> { total, valid, dead } (instant, local)
 *  - `status:checkAll`   ()  -> revalidate all (local token + public VAC), with
 *                               `status:progress` events streamed to the window
 *  - `status:removeDead` ()  -> delete only dead accounts, returns counts
 *
 * Handlers never throw to the renderer; the service returns structured results
 * and unexpected errors are caught and reported as plain messages.
 */

'use strict';

const { createProductionLogger } = require('./productionLogger');

const logger = createProductionLogger('statusIpc');

/**
 * Registers Account Status IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 * @param {() => (Electron.BrowserWindow|null)} getWindow
 */
function registerStatusHandlers(ipcMain, getWindow) {
  const svc = () => require('./accountStatusService');

  ipcMain.handle('status:list', async () => {
    try {
      return { success: true, accounts: svc().listStatuses() };
    } catch (err) {
      logger.error('status:list failed', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('status:summary', async () => {
    try {
      return { success: true, ...svc().computeSummary() };
    } catch (err) {
      logger.error('status:summary failed', err.message);
      return { success: false, error: err.message };
    }
  });

  // Streams `status:progress` events to the window while a scan runs.
  const progressForwarder = () => (payload) => {
    try {
      const win = typeof getWindow === 'function' ? getWindow() : null;
      if (win && !win.isDestroyed()) win.webContents.send('status:progress', payload);
    } catch { /* progress is best-effort */ }
  };

  // Fast, offline token re-validation (Accounts "Refresh").
  ipcMain.handle('status:checkAll', async () => {
    try {
      return await svc().checkAllAccounts({ onProgress: progressForwarder() });
    } catch (err) {
      logger.error('status:checkAll failed', err.message);
      return { success: false, error: err.message };
    }
  });

  // Login-verified scan: signs in to each account (never logs out) to confirm
  // the token, marking accounts that cannot sign in as dead (Account Status
  // "Check All").
  ipcMain.handle('status:loginCheckAll', async () => {
    try {
      return await svc().checkAllViaLogin({ onProgress: progressForwarder() });
    } catch (err) {
      logger.error('status:loginCheckAll failed', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('status:removeDead', async () => {
    try {
      return svc().removeDeadAccounts();
    } catch (err) {
      logger.error('status:removeDead failed', err.message);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerStatusHandlers };
