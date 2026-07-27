/**
 * @module production
 * @description Production-specific configuration settings.
 * Disables debug features, enables optimized performance, and configures
 * production logging and error handling.
 *
 * @example
 * const config = require('./production');
 * if (config.logging.enabled) { ... }
 */

const { isProd, isDev } = require('./environment');

const production = {
  /** Application metadata */
  app: {
    name: 'Steam Manager',
    minWidth: 1024,
    minHeight: 700,
    defaultWidth: 1280,
    defaultHeight: 800
  },

  /** Debug settings - disabled in production */
  debug: {
    enabled: isDev,
    devTools: isDev,
    verboseLogging: isDev,
    showFrameRate: false
  },

  /** Logging configuration */
  logging: {
    enabled: true,
    level: isProd ? 'warn' : 'debug',
    maxFileSize: 5 * 1024 * 1024, // 5MB per log file
    maxFiles: 5, // Keep 5 rotated files
    console: isDev,
    file: true
  },

  /** Performance settings */
  performance: {
    databaseCacheSize: isProd ? 10000 : 2000,
    pageSize: 50,
    maxPageSize: 200,
    lazyLoadThreshold: 100,
    searchDebounceMs: 300,
    renderBatchSize: 50
  },

  /** Security settings */
  security: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    enableRemoteModule: false
  },

  /** Database settings */
  database: {
    journalMode: 'WAL',
    foreignKeys: true,
    busyTimeout: 5000,
    cacheSize: isProd ? -10000 : -2000 // Negative = KB
  },

  /** Auto-update settings */
  update: {
    enabled: isProd,
    checkInterval: 4 * 60 * 60 * 1000, // 4 hours
    autoDownload: false,
    allowPrerelease: false
  },

  /** Crash reporting */
  crashReporting: {
    enabled: isProd,
    submitUrl: null, // Set when crash reporting service is configured
    uploadToServer: false
  },

  /** Backup settings */
  backup: {
    maxBackups: 10,
    backupBeforeUpdate: true,
    includeDatabase: true,
    includeSettings: true,
    includeLogs: false
  }
};

module.exports = production;
