const { getDatabase } = require('../database/database');
const logger = require('../logs/logger');

class SyncManager {
  constructor() {
    this.subscribers = [];
  }

  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('SyncManager subscriber must be a function');
    }
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((fn) => fn !== callback);
    };
  }

  notify(payload) {
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(payload);
      } catch (error) {
        logger.error('syncManager.notify', error);
      }
    });
  }

  async refreshAccount(accountId) {
    const db = getDatabase();
    try {
      const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
      this.notify({ type: 'account:updated', account: row });
      return { success: true, account: row };
    } catch (error) {
      logger.error('syncManager.refreshAccount', error);
      return { success: false, error: error.message };
    }
  }

  async refreshAll() {
    const db = getDatabase();
    try {
      const rows = db.prepare('SELECT * FROM accounts').all();
      this.notify({ type: 'accounts:refreshed', accounts: rows });
      return { success: true, accounts: rows };
    } catch (error) {
      logger.error('syncManager.refreshAll', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SyncManager();
