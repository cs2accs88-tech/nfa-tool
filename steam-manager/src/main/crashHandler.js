/**
 * @module crashHandler
 * @description Production crash handling and error recovery.
 * Captures unhandled exceptions, promise rejections, and renderer crashes.
 * Creates crash reports and logs them for debugging.
 *
 * @example
 * const { initCrashHandler } = require('./crashHandler');
 * initCrashHandler();
 */

const fs = require('fs');
const path = require('path');
const { getLogsPath } = require('../config/environment');

const CRASH_LOG_FILE = 'crash-reports.log';
const MAX_CRASH_LOG_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Ensures the logs directory exists.
 */
function ensureLogsDir() {
  const logsDir = getLogsPath();
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/**
 * Formats a crash report entry.
 * @param {string} type - The crash type.
 * @param {Error|string} error - The error.
 * @returns {string}
 */
function formatCrashEntry(type, error) {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : 'No stack trace';
  return [
    `[${timestamp}] CRASH: ${type}`,
    `Message: ${message}`,
    `Stack: ${stack}`,
    `Platform: ${process.platform} ${process.arch}`,
    `Node: ${process.version}`,
    `Memory: ${JSON.stringify(process.memoryUsage())}`,
    '---',
    ''
  ].join('\n');
}

/**
 * Writes a crash report to the log file.
 * Rotates log if it exceeds max size.
 * @param {string} type - Crash type.
 * @param {Error|string} error - The error.
 */
function writeCrashReport(type, error) {
  try {
    const logsDir = ensureLogsDir();
    const logPath = path.join(logsDir, CRASH_LOG_FILE);

    // Rotate if too large
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > MAX_CRASH_LOG_SIZE) {
        const rotatedPath = path.join(logsDir, `crash-reports-${Date.now()}.log`);
        fs.renameSync(logPath, rotatedPath);
      }
    }

    const entry = formatCrashEntry(type, error);
    fs.appendFileSync(logPath, entry, 'utf8');
  } catch {
    // Last resort: write to stderr
    process.stderr.write(`[CRASH] Failed to write crash report: ${type}\n`);
  }
}

/**
 * Initializes all crash handlers for the application.
 * Should be called early in the main process startup.
 */
function initCrashHandler() {
  // Unhandled exceptions
  process.on('uncaughtException', (error) => {
    writeCrashReport('UncaughtException', error);
    console.error('[CRASH] Uncaught Exception:', error.message);
    // In production, attempt graceful shutdown
    try {
      const { app } = require('electron');
      if (app) {
        app.quit();
      }
    } catch {
      process.exit(1);
    }
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    writeCrashReport('UnhandledRejection', error);
    console.error('[CRASH] Unhandled Rejection:', error.message);
  });

  // Renderer process crashes (registered when window is created)
  try {
    const { app } = require('electron');

    app.on('render-process-gone', (_event, _webContents, details) => {
      writeCrashReport('RendererCrash', new Error(
        `Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`
      ));
      console.error('[CRASH] Renderer process crashed:', details.reason);
    });

    app.on('child-process-gone', (_event, details) => {
      writeCrashReport('ChildProcessCrash', new Error(
        `Child process gone: type=${details.type}, reason=${details.reason}`
      ));
    });
  } catch {
    // Not in Electron context (testing)
  }
}

/**
 * Gets recent crash reports.
 * @param {number} [limit=10] - Number of recent reports to return.
 * @returns {string[]} Array of crash report entries.
 */
function getRecentCrashes(limit = 10) {
  try {
    const logsDir = getLogsPath();
    const logPath = path.join(logsDir, CRASH_LOG_FILE);

    if (!fs.existsSync(logPath)) return [];

    const content = fs.readFileSync(logPath, 'utf8');
    const entries = content.split('---\n').filter(Boolean);
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

module.exports = {
  initCrashHandler,
  writeCrashReport,
  getRecentCrashes
};
