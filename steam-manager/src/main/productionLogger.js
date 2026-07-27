/**
 * @module productionLogger
 * @description Production-grade logging with file rotation and log levels.
 * Writes to both console (in dev) and file (always), with automatic rotation.
 *
 * @example
 * const { createProductionLogger } = require('./productionLogger');
 * const logger = createProductionLogger('database');
 * logger.info('Database initialized');
 * logger.error('Connection failed', error.message);
 */

const fs = require('fs');
const path = require('path');
const { getLogsPath, isDev } = require('../config/environment');
const config = require('../config/production');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_FILE = 'app.log';

/**
 * Ensures the log directory exists.
 * @returns {string} The logs directory path.
 */
function ensureLogDir() {
  const dir = getLogsPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Rotates the log file if it exceeds the max size.
 * @param {string} logPath - Path to the log file.
 */
function rotateIfNeeded(logPath) {
  try {
    if (!fs.existsSync(logPath)) return;
    const stats = fs.statSync(logPath);
    if (stats.size > config.logging.maxFileSize) {
      const dir = path.dirname(logPath);
      const rotated = path.join(dir, `app-${Date.now()}.log`);
      fs.renameSync(logPath, rotated);
      cleanOldLogs(dir);
    }
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Removes old rotated log files beyond the max count.
 * @param {string} dir - The logs directory.
 */
function cleanOldLogs(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    const excess = files.slice(config.logging.maxFiles);
    for (const file of excess) {
      fs.unlinkSync(path.join(dir, file.name));
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Creates a logger instance for a specific component.
 * @param {string} component - The component name for log tagging.
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
function createProductionLogger(component) {
  const currentLevel = LOG_LEVELS[config.logging.level] || LOG_LEVELS.info;

  function shouldLog(level) {
    return LOG_LEVELS[level] >= currentLevel;
  }

  function formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    return `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
  }

  function writeToFile(formatted) {
    if (!config.logging.file) return;
    try {
      const dir = ensureLogDir();
      const logPath = path.join(dir, LOG_FILE);
      rotateIfNeeded(logPath);
      fs.appendFileSync(logPath, formatted + '\n', 'utf8');
    } catch {
      // Silent fail for logging
    }
  }

  function log(level, ...args) {
    if (!config.logging.enabled) return;
    if (!shouldLog(level)) return;

    const formatted = formatMessage(level, ...args);

    if (config.logging.console) {
      const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleFn(formatted);
    }

    writeToFile(formatted);
  }

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args)
  };
}

module.exports = {
  createProductionLogger
};
