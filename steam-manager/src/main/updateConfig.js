/**
 * @module updateConfig
 * @description Configuration for the auto-update system.
 * Defines update check intervals, channels, and behavior.
 *
 * @example
 * const updateConfig = require('./updateConfig');
 * if (updateConfig.enabled) { ... }
 */

const config = require('../config/production');

const updateConfig = {
  /** Whether auto-update is enabled */
  enabled: config.update.enabled,

  /** Interval between update checks (ms) */
  checkInterval: config.update.checkInterval,

  /** Whether to auto-download updates */
  autoDownload: config.update.autoDownload,

  /** Whether to allow pre-release versions */
  allowPrerelease: config.update.allowPrerelease,

  /** Update feed URL (set by electron-builder publish config) */
  feedURL: null,

  /** Whether to backup before updating */
  backupBeforeUpdate: config.backup.backupBeforeUpdate,

  /** Update channels */
  channels: {
    stable: 'latest',
    beta: 'beta',
    alpha: 'alpha'
  },

  /** Current channel */
  currentChannel: 'stable'
};

module.exports = updateConfig;
