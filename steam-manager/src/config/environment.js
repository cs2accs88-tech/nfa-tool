/**
 * @module environment
 * @description Detects and exposes the current runtime environment.
 * Determines whether the app is running in development or production mode.
 */

const path = require('path');
const fs = require('fs');

/**
 * Checks if the application is running in development mode.
 * @returns {boolean}
 */
function isDevelopment() {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NODE_ENV === 'production') return false;
  if (process.argv.includes('--dev')) return true;

  try {
    const { app } = require('electron');
    return !app.isPackaged;
  } catch {
    return process.env.NODE_ENV !== 'production';
  }
}

const isDev = isDevelopment();
const isProd = !isDev;

/**
 * Gets the application data path.
 * Production: %APPDATA%/Steam Manager
 * Development: ./data
 * @returns {string}
 */
function getAppDataPath() {
  if (isProd) {
    try {
      const { app } = require('electron');
      return app.getPath('userData');
    } catch {
      return path.join(process.cwd(), 'data');
    }
  }
  return path.join(process.cwd(), 'data');
}

/**
 * Gets the logs directory path.
 * @returns {string}
 */
function getLogsPath() {
  const base = getAppDataPath();
  const logsDir = path.join(base, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/**
 * Gets the backups directory path.
 * @returns {string}
 */
function getBackupsPath() {
  const base = getAppDataPath();
  const backupsDir = path.join(base, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  return backupsDir;
}

module.exports = {
  isDev,
  isProd,
  isDevelopment,
  getAppDataPath,
  getLogsPath,
  getBackupsPath
};
