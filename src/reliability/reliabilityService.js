const { getDatabase } = require('../database/database');
const logger = require('../logs/logger');
const errorLogger = require('../logs/errorLogger');

class ReliabilityService {
  async runStartupChecks() {
    const dbHealth = await this.databaseHealthCheck();
    if (!dbHealth.success) {
      logger.error('reliabilityService.runStartupChecks', { action: 'startupCheck', message: dbHealth.error });
      return dbHealth;
    }

    const integrity = await this.integrityCheck();
    if (!integrity.success) {
      logger.error('reliabilityService.runStartupChecks', { action: 'integrityCheck', message: integrity.error });
    }

    logger.info('reliabilityService.runStartupChecks', {
      action: 'startupCheck',
      message: 'Database startup integrity validated'
    });

    return { success: true };
  }

  async databaseHealthCheck() {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
      return { success: true, count: row.count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async integrityCheck() {
    try {
      const db = getDatabase();
      const result = db.prepare('PRAGMA integrity_check').get();
      if (result.integrity_check !== 'ok') {
        return { success: false, error: result.integrity_check };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  attachProcessHandlers() {
    process.on('uncaughtException', (error) => {
      errorLogger.logError('uncaughtException', error);
      logger.error('ReliabilityService', { action: 'uncaughtException', message: error.message, stack: error.stack });
    });

    process.on('unhandledRejection', (reason) => {
      errorLogger.logError('unhandledRejection', { message: reason?.message || String(reason), stack: reason?.stack || null });
      logger.error('ReliabilityService', { action: 'unhandledRejection', message: reason?.message || String(reason), stack: reason?.stack || null });
    });
  }
}

module.exports = new ReliabilityService();
