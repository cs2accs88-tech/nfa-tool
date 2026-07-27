const { ipcMain, shell } = require('electron');
const accountController = require('../controllers/accountController');
const statisticsController = require('../statistics/statisticsController');
const backupController = require('../backup/backupController');
const { importFile } = require('../imports/importer');
const stateService = require('../state/stateService');
const autosaveService = require('../autosave/autosaveService');

function setupIpcHandlers() {
  ipcMain.handle('accounts:load', async (event, options) => {
    return accountController.getAllAccounts(options || {});
  });

  ipcMain.handle('accounts:search', async (event, query, options) => {
    return accountController.searchAccounts(query || '', options || {});
  });

  ipcMain.handle('accounts:get', async (event, id) => {
    return accountController.getAccountById(id);
  });

  ipcMain.handle('accounts:add', async (event, account) => {
    return accountController.createAccount(account);
  });

  ipcMain.handle('accounts:update', async (event, account) => {
    return accountController.updateAccount(account);
  });

  ipcMain.handle('accounts:delete', async (event, id) => {
    return accountController.deleteAccount(id);
  });

  ipcMain.handle('accounts:addNote', async (event, accountId, noteText) => {
    return accountController.addNoteToAccount(accountId, noteText);
  });

  ipcMain.handle('accounts:bulkDelete', async (event, ids) => {
    return accountController.bulkDelete(ids);
  });

  ipcMain.handle('accounts:bulkTag', async (event, ids, tags, mode) => {
    return accountController.bulkAddTags(ids, tags, mode);
  });

  ipcMain.handle('statistics:dashboard', async (event, filters) => {
    return statisticsController.getDashboardStats(filters || {});
  });

  ipcMain.handle('statistics:exportJson', async (event, filters) => {
    return statisticsController.exportJson(filters || {});
  });

  ipcMain.handle('statistics:exportCsv', async (event, filters) => {
    return statisticsController.exportCsv(filters || {});
  });

  ipcMain.handle('statistics:clearCache', async () => {
    return statisticsController.clearCache();
  });

  ipcMain.handle('backup:list', async () => {
    return backupController.getBackups();
  });

  ipcMain.handle('backup:getDetails', async (event, name) => {
    return backupController.getBackupDetails(name);
  });

  ipcMain.handle('backup:create', async (event, options) => {
    return backupController.createBackup(options || {});
  });

  ipcMain.handle('backup:delete', async (event, name) => {
    return backupController.deleteBackup(name);
  });

  ipcMain.handle('backup:verify', async (event, name) => {
    return backupController.verifyBackup(name);
  });

  ipcMain.handle('backup:restore', async (event, name) => {
    return backupController.restoreBackup(name);
  });

  ipcMain.handle('backup:getSettings', async () => {
    return backupController.getBackupSettings();
  });

  ipcMain.handle('backup:saveSettings', async (event, settings) => {
    return backupController.saveBackupSettings(settings || {});
  });

  ipcMain.handle('accounts:openProfile', async (event, url) => {
    if (!url) {
      return { success: false, error: 'Profile URL is missing.' };
    }
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('import:start', async (event, filePath, options) => {
    try {
      const result = await importFile(filePath, options || {});
      return { success: true, report: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('state:load', async () => {
    try {
      return { success: true, state: stateService.loadState() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('state:update', async (event, stateUpdate) => {
    try {
      const state = stateService.updateState(stateUpdate);
      return { success: true, state };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('autosave:getState', async () => {
    try {
      return { success: true, state: autosaveService.getState() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('autosave:updateSettings', async (event, settings) => {
    try {
      autosaveService.initialize(settings);
      return { success: true, state: autosaveService.getState() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  setupIpcHandlers
};
