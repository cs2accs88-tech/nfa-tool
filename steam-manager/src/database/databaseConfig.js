/**
 * @module databaseConfig
 * @description Resolves the database file path.
 * In production (packaged EXE), stores data in the user's AppData folder.
 * In development, stores data in the project's data/ folder.
 */

const path = require('path');
const fs = require('fs');

/**
 * Gets the correct base directory for application data.
 * - Packaged app: %APPDATA%/Steam Manager/
 * - Development: ./data/
 * @returns {string}
 */
function getDataDirectory() {
  try {
    const { app } = require('electron');
    if (app && app.isPackaged) {
      // Production: use userData path (e.g. C:\Users\X\AppData\Roaming\Steam Manager)
      return app.getPath('userData');
    }
  } catch {
    // Not in Electron context (tests, CLI)
  }

  // Development or test: use project-local data folder
  return path.join(process.cwd(), 'data');
}

const dataDirectory = getDataDirectory();
const databaseFile = process.env.DATABASE_FILE || 'steam-manager.db';
const databasePath = path.join(dataDirectory, databaseFile);

// Ensure the data directory exists
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

module.exports = {
  databasePath,
  dataDirectory
};
