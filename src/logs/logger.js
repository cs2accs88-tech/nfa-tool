const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname);
const LOG_FILE = path.join(LOG_DIR, 'application.log');

function ensureLogDirectory() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeLog(entry) {
  ensureLogDirectory();
  const message = `${entry.timestamp} | ${entry.level.toUpperCase()} | ${entry.source} | ${entry.action || 'unknown'} | ${entry.message || ''}${entry.details ? ` | ${JSON.stringify(entry.details)}` : ''}\n`;
  fs.appendFileSync(LOG_FILE, message, 'utf8');
}

function info(source, details = {}) {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    source,
    action: details.action || 'info',
    message: details.message || 'Operation completed',
    details: details.details || null
  });
}

function warn(source, details = {}) {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'warn',
    source,
    action: details.action || 'warning',
    message: details.message || 'Warning occurred',
    details: details.details || null
  });
}

function error(source, error) {
  const details = error && error.stack ? { stack: error.stack, message: error.message } : error;
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'error',
    source,
    action: error.action || 'error',
    message: error.message || 'Unexpected error',
    details
  });
}

module.exports = {
  info,
  warn,
  error
};
