const saveQueue = require('./saveQueue');
const recoveryManager = require('./recoveryManager');
const logger = require('../logs/logger');

class AutosaveService {
  constructor() {
    this.active = true;
    this.queue = saveQueue;
    this.recovery = recoveryManager;
    this.settings = {
      enabled: true,
      intervalMs: 10000,
      instantSave: false,
      delayMs: 500,
      manualOnly: false
    };
  }

  initialize(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    this.queue.setSettings(this.settings);
    this.recovery.loadRecoveryState?.();
    this.queue.restartInterval();
    logger.info('autosaveService.initialize', { settings: this.settings });
  }

  async trackChange(change) {
    if (!this.settings.enabled) {
      return { success: false, error: 'Auto-save disabled' };
    }

    this.queue.addChange(change);
    this.recovery.markUnsavedChanges();

    if (this.settings.instantSave) {
      await this.queue.processQueue();
      if (this.queue.getPendingCount() === 0) {
        this.recovery.markSaved();
      }
    }

    return { success: true, pending: this.queue.getPendingCount() };
  }

  async flush() {
    try {
      await this.queue.processQueue();
      if (this.queue.getPendingCount() === 0) {
        this.recovery.markSaved();
      }
      return { success: true };
    } catch (error) {
      this.recovery.markError(error);
      return { success: false, error: error.message };
    }
  }

  getState() {
    return {
      enabled: this.settings.enabled,
      instantSave: this.settings.instantSave,
      manualOnly: this.settings.manualOnly,
      intervalMs: this.settings.intervalMs,
      delayMs: this.settings.delayMs,
      queueState: this.queue.getQueueState(),
      recoveryState: this.recovery.getRecoveryData()
    };
  }

  async recover() {
    return this.recovery.recover();
  }
}

module.exports = new AutosaveService();
