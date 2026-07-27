const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { databasePath } = require('./databaseConfig');

let dbInstance = null;

function ensureDatabaseFolder() {
  const folder = path.dirname(databasePath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

function initDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDatabaseFolder();

  try {
    dbInstance = new Database(databasePath, {
      fileMustExist: false,
      verbose: null
    });
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    return dbInstance;
  } catch (error) {
    throw new Error(`Failed to initialize database: ${error.message}`);
  }
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};
