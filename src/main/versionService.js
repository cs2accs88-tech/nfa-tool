const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database/database');
const { getSchemaVersion } = require('../database/migrationManager');

const packagePath = path.join(__dirname, '..', '..', 'package.json');
let packageInfo = {};

try {
  const content = fs.readFileSync(packagePath, 'utf8');
  packageInfo = JSON.parse(content);
} catch {
  packageInfo = {};
}

function getAppVersion() {
  return packageInfo.version || '0.0.0';
}

function getAppName() {
  return packageInfo.name || 'steam-manager';
}

function getDatabaseVersion() {
  try {
    const db = getDatabase();
    return getSchemaVersion(db);
  } catch {
    return 0;
  }
}

function getVersionInfo() {
  return {
    appName: getAppName(),
    appVersion: getAppVersion(),
    databaseVersion: getDatabaseVersion(),
    releaseNotes: getReleaseNotes(getAppVersion())
  };
}

function getReleaseNotes(version) {
  try {
    const notesPath = path.join(__dirname, '..', 'config', 'releaseNotes.json');
    const raw = fs.readFileSync(notesPath, 'utf8');
    const notes = JSON.parse(raw);
    return notes[version] || null;
  } catch {
    return null;
  }
}

module.exports = {
  getAppVersion,
  getAppName,
  getDatabaseVersion,
  getVersionInfo,
  getReleaseNotes
};