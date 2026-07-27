/**
 * @module preload
 * @description Preload script for the renderer process.
 * Exposes a safe API to the renderer via contextBridge.
 * No Node.js APIs are exposed directly — only whitelisted IPC channels.
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Whitelisted IPC channels for renderer → main communication.
 */
const ALLOWED_INVOKE_CHANNELS = [
  'app:getVersion',
  'app:getName',
  'app:getDataPath',
  'app:status',
  'shell:openExternal',
  'clipboard:write',
  'window:minimize',
  'window:maximize',
  'window:close',
  'token:import',
  'token:importFile',
  'accounts:list',
  'accounts:count',
  'accounts:copyToken',
  'accounts:delete',
  'steam:loginClient',
  'steam:getActiveClient',
  'status:list',
  'status:summary',
  'status:checkAll',
  'status:loginCheckAll',
  'status:removeDead',
  'profile:generate',
  'profile:validate',
  'profile:update',
  'profile:delete',
  'profile:open',
  'profile:copy',
  'profile:get',
  'profile:history',
  'profile:extractId',
  'profile:resolve',
  'profile:batchGenerate',
  'update:check',
  'update:download',
  'update:install',
  'update:getState',
  'update:getHistory',
  'update:getSettings',
  'update:setSettings'
];

contextBridge.exposeInMainWorld('api', {
  /**
   * Invoke an IPC handler in the main process.
   * Only whitelisted channels are allowed.
   */
  invoke: (channel, ...args) => {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /** App info shortcuts */
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getName: () => ipcRenderer.invoke('app:getName'),

  /** Window controls */
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  /** Profile operations */
  profile: {
    generate: (accountId) => ipcRenderer.invoke('profile:generate', accountId),
    validate: (accountId) => ipcRenderer.invoke('profile:validate', accountId),
    update: (accountId, updates) => ipcRenderer.invoke('profile:update', accountId, updates),
    delete: (accountId) => ipcRenderer.invoke('profile:delete', accountId),
    open: (accountId) => ipcRenderer.invoke('profile:open', accountId),
    copy: (accountId) => ipcRenderer.invoke('profile:copy', accountId),
    get: (accountId) => ipcRenderer.invoke('profile:get', accountId),
    history: (accountId, opts) => ipcRenderer.invoke('profile:history', accountId, opts),
    batchGenerate: () => ipcRenderer.invoke('profile:batchGenerate')
  },

  /** Update operations */
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getState: () => ipcRenderer.invoke('update:getState'),
    getHistory: (limit) => ipcRenderer.invoke('update:getHistory', limit),
    getSettings: () => ipcRenderer.invoke('update:getSettings'),
    setSettings: (patch) => ipcRenderer.invoke('update:setSettings', patch),
    /**
     * Subscribes to live update lifecycle events (checking, available,
     * downloading with progress, downloaded, installing, error). Returns an
     * unsubscribe function.
     * @param {(status:object)=>void} callback
     * @returns {() => void}
     */
    onStatus: (callback) => {
      const listener = (_event, data) => { try { callback(data); } catch { /* ignore */ } };
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    }
  },

  /** Token import + account operations */
  tokens: {
    import: (text) => ipcRenderer.invoke('token:import', text),
    importFile: () => ipcRenderer.invoke('token:importFile')
  },
  accounts: {
    list: (opts) => ipcRenderer.invoke('accounts:list', opts),
    count: () => ipcRenderer.invoke('accounts:count'),
    copyToken: (id) => ipcRenderer.invoke('accounts:copyToken', id),
    delete: (id) => ipcRenderer.invoke('accounts:delete', id)
  },

  /** Local Steam client sign-in ("injection") */
  auth: {
    loginClient: (accountId) => ipcRenderer.invoke('steam:loginClient', accountId),
    getActiveClient: () => ipcRenderer.invoke('steam:getActiveClient')
  },

  /** Account Status: token validity + VAC checking, dead-account cleanup */
  status: {
    list: () => ipcRenderer.invoke('status:list'),
    summary: () => ipcRenderer.invoke('status:summary'),
    checkAll: () => ipcRenderer.invoke('status:checkAll'),
    loginCheckAll: () => ipcRenderer.invoke('status:loginCheckAll'),
    removeDead: () => ipcRenderer.invoke('status:removeDead'),
    /**
     * Subscribes to progress events during a check. Returns an unsubscribe fn.
     * @param {(p:{done:number,total:number})=>void} callback
     * @returns {() => void}
     */
    onProgress: (callback) => {
      const listener = (_event, data) => { try { callback(data); } catch { /* ignore */ } };
      ipcRenderer.on('status:progress', listener);
      return () => ipcRenderer.removeListener('status:progress', listener);
    }
  }
});
