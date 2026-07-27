const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steamManager', {
  appName: process.env.APP_TITLE || 'Steam Manager',
  appEnv: process.env.APP_ENV || 'development',
  api: {
    loadAccounts: (options) => ipcRenderer.invoke('accounts:load', options),
    searchAccounts: (query, options) => ipcRenderer.invoke('accounts:search', query, options),
    getAccount: (id) => ipcRenderer.invoke('accounts:get', id),
    addAccount: (account) => ipcRenderer.invoke('accounts:add', account),
    updateAccount: (account) => ipcRenderer.invoke('accounts:update', account),
    deleteAccount: (id) => ipcRenderer.invoke('accounts:delete', id),
    addAccountNote: (accountId, noteText) => ipcRenderer.invoke('accounts:addNote', accountId, noteText),
    bulkDeleteAccounts: (ids) => ipcRenderer.invoke('accounts:bulkDelete', ids),
    bulkTagAccounts: (ids, tags, mode) => ipcRenderer.invoke('accounts:bulkTag', ids, tags, mode),
    openProfile: (url) => ipcRenderer.invoke('accounts:openProfile', url),
    importFile: (filePath, options) => ipcRenderer.invoke('import:start', filePath, options),
    getDashboardStats: (filters) => ipcRenderer.invoke('statistics:dashboard', filters),
    exportStatisticsJson: (filters) => ipcRenderer.invoke('statistics:exportJson', filters),
    exportStatisticsCsv: (filters) => ipcRenderer.invoke('statistics:exportCsv', filters),
    clearStatisticsCache: () => ipcRenderer.invoke('statistics:clearCache'),
    listBackups: () => ipcRenderer.invoke('backup:list'),
    getBackupDetails: (name) => ipcRenderer.invoke('backup:getDetails', name),
    createBackup: (options) => ipcRenderer.invoke('backup:create', options),
    deleteBackup: (name) => ipcRenderer.invoke('backup:delete', name),
    verifyBackup: (name) => ipcRenderer.invoke('backup:verify', name),
    restoreBackup: (name) => ipcRenderer.invoke('backup:restore', name),
    getBackupSettings: () => ipcRenderer.invoke('backup:getSettings'),
    saveBackupSettings: (settings) => ipcRenderer.invoke('backup:saveSettings', settings),
    loadState: () => ipcRenderer.invoke('state:load'),
    updateState: (stateUpdate) => ipcRenderer.invoke('state:update', stateUpdate),
    getAutosaveState: () => ipcRenderer.invoke('autosave:getState'),
    updateAutosaveSettings: (settings) => ipcRenderer.invoke('autosave:updateSettings', settings)
  }
});
