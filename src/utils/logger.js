const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDirectory, 'app.log');

if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} - ${message}\n`;
  fs.appendFileSync(logFile, line, { encoding: 'utf8' });
}

module.exports = {
  log
};
