/**
 * @module tokenIpcHandlers
 * @description IPC handlers for token import and account listing.
 * Registered on the Electron ipcMain instance.
 *
 * Channels:
 *  - token:import        (text)  -> import pasted token text
 *  - token:importFile    ()      -> open file dialog, read file, import
 *  - accounts:list       (opts)  -> list accounts (masked token) for the UI
 *  - accounts:count      ()      -> total account count
 */

const fs = require('fs');

/**
 * Masks a token for display (keeps only a short prefix).
 * @param {string|null} token
 * @returns {string}
 */
function maskToken(token) {
  if (!token) return '';
  const t = String(token);
  if (t.length <= 12) return '••••••';
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

/**
 * Registers token/account IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 * @param {Electron.BrowserWindow} getWindow - function returning the main window
 */
function registerTokenHandlers(ipcMain, getWindow) {
  const { importTokens } = require('../imports/tokenImportService');
  const { getDatabase } = require('../database/connection');

  ipcMain.handle('token:import', async (_event, text) => {
    try {
      return importTokens(text, { sourceName: 'pasted tokens' });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('token:importFile', async () => {
    try {
      const { dialog } = require('electron');
      const win = typeof getWindow === 'function' ? getWindow() : null;
      const result = await dialog.showOpenDialog(win, {
        title: 'Select token file',
        properties: ['openFile'],
        filters: [
          { name: 'Token / Text files', extensions: ['txt', 'tokens', 'csv', 'dat'] },
          { name: 'All files', extensions: ['*'] }
        ]
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf8');
      const path = require('path');
      return importTokens(content, { sourceName: path.basename(filePath) });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:count', async () => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT COUNT(*) AS c FROM accounts').get();
      return { success: true, count: row.c };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:list', async (_event, opts = {}) => {
    try {
      const db = getDatabase();
      const limit = Math.min(Number(opts.limit) || 100, 500);
      const offset = Number(opts.offset) || 0;
      const rows = db.prepare(`
        SELECT id, steamId64, username, personaName, avatarUrl, loginToken, rank, primeStatus, vacStatus,
               gameBanStatus, communityBanned, cooldownStatus, earnedServiceMedal, inventoryValue, rating,
               medalCount, rareItemCount, steamProfileURL, profileVisibility,
               lastCheckedAt, lastUpdated, updateStatus, updateError, updatedAt
        FROM accounts
        ORDER BY updatedAt DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      const accounts = rows.map((r) => ({
        id: r.id,
        steamId64: r.steamId64,
        username: r.personaName || r.username,
        avatarUrl: r.avatarUrl || null,
        tokenMasked: maskToken(r.loginToken),
        hasToken: !!r.loginToken,
        rank: r.rank,
        prime: !!r.primeStatus,
        vacBanned: !!r.vacStatus,
        gameBanned: !!r.gameBanStatus,
        communityBanned: !!r.communityBanned,
        cooldown: !!r.cooldownStatus,
        serviceMedal: !!r.earnedServiceMedal,
        inventoryValue: r.inventoryValue,
        rating: r.rating,
        medals: r.medalCount,
        rareItems: r.rareItemCount,
        profileUrl: r.steamProfileURL,
        visibility: r.profileVisibility || null,
        lastChecked: r.lastCheckedAt,
        lastUpdated: r.lastUpdated || null,
        updateStatus: r.updateStatus || 'idle',
        updateError: r.updateError || null
      }));

      return { success: true, accounts };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:copyToken', async (_event, id) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT loginToken FROM accounts WHERE id = ?').get(id);
      if (!row || !row.loginToken) return { success: false, error: 'No token found' };
      const { clipboard } = require('electron');
      clipboard.writeText(row.loginToken);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete a single account. This only removes the local database row — it does
  // NOT contact Steam or log anything out, so other accounts' tokens are safe.
  ipcMain.handle('accounts:delete', async (_event, id) => {
    try {
      const db = getDatabase();
      const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
      if (result.changes === 0) return { success: false, error: 'Account not found' };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerTokenHandlers };
