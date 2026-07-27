const fs = require('fs');
const path = require('path');
const saveQueue = require('./saveQueue');
const logger = require('../logs/logger');

const RECOVERY_FILE = path.join(__dirname, '..', 'logs', 'recovery_state.json');

class RecoveryManager {
  constructor() {
    this.recoveryFile = RECOVERY_FILE;
    this.ensureRecoveryFile();
    this.recoveryState = this.loadRecoveryState();
  }

  ensureRecoveryFile() {
    const folder = path.dirname(this.recoveryFile);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    if (!fs.existsSync(this.recoveryFile)) {
      fs.writeFileSync(this.recoveryFile, JSON.stringify({ unsavedChanges: false, queue: [], lastSavedAt: null, lastError: null }, null, 2), 'utf8');
    }
  }

  loadRecoveryState() {
    try {
      const content = fs.readFileSync(this.recoveryFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('recoveryManager.loadRecoveryState', error);
      return { unsavedChanges: false, queue: [], lastSavedAt: null, lastError: null };
    }
  }

  persistRecoveryState() {
    try {
      fs.writeFileSync(this.recoveryFile, JSON.stringify(this.recoveryState, null, 2), 'utf8');
    } catch (error) {
      logger.error('recoveryManager.persistRecoveryState', error);
    }
  }

  markUnsavedChanges() {
    this.recoveryState.unsavedChanges = true;
    this.recoveryState.queue = saveQueue.getQueue();
    this.recoveryState.lastSavedAt = null;
    this.persistRecoveryState();
  }

  markSaved() {
    this.recoveryState.unsavedChanges = false;
    this.recoveryState.queue = [];
    this.recoveryState.lastSavedAt = new Date().toISOString();
    this.recoveryState.lastError = null;
    this.persistRecoveryState();
  }

  markError(error) {
    this.recoveryState.lastError = error.message || String(error);
    this.persistRecoveryState();
  }

  hasRecoveryData() {
    return Boolean(this.recoveryState.unsavedChanges && Array.isArray(this.recoveryState.queue) && this.recoveryState.queue.length > 0);
  }

  getRecoveryData() {
    return this.recoveryState;
  }

  async recover() {
    if (!this.hasRecoveryData()) {
      return { success: true, recovered: false };
    }

    const queue = this.recoveryState.queue || [];
    queue.forEach((item) => saveQueue.addChange(item));
    try {
      await saveQueue.processQueue();
      this.markSaved();
      return { success: true, recovered: true, count: queue.length };
    } catch (error) {
      this.markError(error);
      return { success: false, recovered: false, error: error.message };
    }
  }
}

module.exports = new RecoveryManager();
