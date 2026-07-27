const os = require('os');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database/database');
const { getAppVersion, getDatabaseVersion } = require('./versionService');
const { getBackupSettings } = require('../backup/backupService');
const { loadState } = require('../state/stateService');

function getMemoryUsage() {
  return {
    rss: process.memoryUsage().rss,
    heapTotal: process.memoryUsage().heapTotal,
    heapUsed: process.memoryUsage().heapUsed,
    external: process.memoryUsage().external,
    arrayBuffers: process.memoryUsage().arrayBuffers
  };
}

function getStorageInfo() {
  const dataPath = path.join(__dirname, '..', 'data');
  const logsPath = path.join(__dirname, '..', 'logs');
  const backupPath = path.join(__dirname, '..', 'backups');

  return {
    dataFolderExists: fs.existsSync(dataPath),
    logsFolderExists: fs.existsSync(logsPath),
    backupFolderExists: fs.existsSync(backupPath)
  };
}

function getDatabaseHealth() {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) AS count FROM accounts').get();
    return { success: true, recordCount: row.count };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getHealthStatus() {
  return {
    appVersion: getAppVersion(),
    databaseVersion: getDatabaseVersion(),
    environment: process.env.APP_ENV || 'development',
    uptimeSeconds: process.uptime(),
    memory: getMemoryUsage(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    },
    storage: getStorageInfo(),
    database: getDatabaseHealth(),
    backupSettings: getBackupSettings(),
    appState: loadState()
  };
}

module.exports = {
  getHealthStatus
};