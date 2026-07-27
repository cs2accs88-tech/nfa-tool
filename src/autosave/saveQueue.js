const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/database');
const { createChange } = require('./changeTracker');
const logger = require('../logs/logger');

const QUEUE_FILE = path.join(__dirname, '..', 'logs', 'save_queue.json');
const SETTINGS_FILE = path.join(__dirname, 'autosave_settings.json');

class SaveQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.retryDelayMs = 2000;
    this.maxRetries = 3;
    this.debounceHandle = null;
    this.saveIntervalHandle = null;
    this.settings = {
      enabled: true,
      intervalMs: 10000,
      instantSave: false,
      delayMs: 500,
      manualOnly: false
    };
    this.ensureQueueFile();
    this.ensureSettingsFile();
    this.loadQueue();
    this.loadSettings();
  }

  ensureQueueFile() {
    const dir = path.dirname(QUEUE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(QUEUE_FILE)) {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  ensureSettingsFile() {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
    }
  }

  loadQueue() {
    try {
      const content = fs.readFileSync(QUEUE_FILE, 'utf8');
      this.queue = JSON.parse(content) || [];
    } catch (error) {
      logger.error('saveQueue.loadQueue', error);
      this.queue = [];
    }
  }

  persistQueue() {
    try {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (error) {
      logger.error('saveQueue.persistQueue', error);
    }
  }

  loadSettings() {
    try {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      this.settings = { ...this.settings, ...JSON.parse(content) };
    } catch (error) {
      logger.error('saveQueue.loadSettings', error);
    }
  }

  persistSettings() {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      logger.error('saveQueue.persistSettings', error);
    }
  }

  addChange(change) {
    if (!change || !change.id) {
      change = createChange({ action: 'UPDATE', metadata: { source: 'saveQueue' } });
    }

    const duplicate = this.queue.find((item) => item.action === change.action && item.accountId === change.accountId && item.field === change.field && item.changedAt === change.changedAt);
    if (duplicate) {
      return duplicate;
    }

    const existing = this.queue.find((item) => item.accountId === change.accountId && item.field === change.field && item.action === change.action);
    if (existing) {
      existing.newValue = change.newValue;
      existing.changedAt = change.changedAt;
      existing.retries = 0;
      existing.status = 'pending';
      this.persistQueue();
      return existing;
    }

    this.queue.push({ ...change, status: 'pending', retries: 0 });
    this.persistQueue();
    if (this.settings.instantSave) {
      this.triggerSave();
    } else {
      this.scheduleSave();
    }
    return change;
  }

  scheduleSave() {
    if (this.settings.manualOnly || !this.settings.enabled) {
      return;
    }

    clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => this.triggerSave(), this.settings.delayMs);
  }

  triggerSave() {
    if (this.processing || this.settings.manualOnly || !this.settings.enabled) {
      return;
    }

    this.processQueue().catch((error) => logger.error('saveQueue.triggerSave', error));
  }

  async processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    const pending = this.queue.filter((item) => item.status === 'pending');
    if (pending.length === 0) {
      this.processing = false;
      return;
    }

    const batch = pending.slice(0, 20);
    logger.info('saveQueue.processQueue', { batchSize: batch.length });

    try {
      await this.commitBatch(batch);
      batch.forEach((item) => {
        item.status = 'saved';
        item.savedAt = new Date().toISOString();
      });
      this.persistQueue();
    } catch (error) {
      logger.error('saveQueue.processQueue', error);
      batch.forEach((item) => {
        item.retries = (item.retries || 0) + 1;
        item.status = item.retries >= this.maxRetries ? 'failed' : 'pending';
        item.lastError = error.message;
      });
      this.persistQueue();
      if (batch.some((item) => item.status === 'pending')) {
        setTimeout(() => this.triggerSave(), this.retryDelayMs);
      }
    } finally {
      this.processing = false;
    }
  }

  async commitBatch(batch) {
    const db = getDatabase();
    const transaction = db.transaction((records) => {
      records.forEach((change) => {
        const payload = change;
        db.prepare(`INSERT INTO activity_logs (accountId, accountName, action, details, createdAt) VALUES (@accountId, @accountName, @action, @details, @createdAt)`).run({
          accountId: payload.accountId,
          accountName: payload.accountSteamId || null,
          action: payload.action,
          details: JSON.stringify({ field: payload.field, oldValue: payload.oldValue, newValue: payload.newValue, metadata: payload.metadata }),
          createdAt: payload.changedAt
        });
      });
    });

    transaction(batch);
  }

  getPendingCount() {
    return this.queue.filter((item) => item.status === 'pending').length;
  }

  setSettings(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    this.persistSettings();
    this.restartInterval();
  }

  restartInterval() {
    clearInterval(this.saveIntervalHandle);
    if (this.settings.manualOnly || !this.settings.enabled) {
      return;
    }
    this.saveIntervalHandle = setInterval(() => this.triggerSave(), this.settings.intervalMs);
  }

  getQueueState() {
    return {
      queueLength: this.queue.length,
      pendingCount: this.getPendingCount(),
      processing: this.processing,
      settings: this.settings
    };
  }

  getQueue() {
    return this.queue.slice();
  }
}

module.exports = new SaveQueue();
