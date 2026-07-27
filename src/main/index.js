const path = require('path');
const { app, BrowserWindow } = require('electron');
const { initDatabase } = require('../database/database');
const { setupIpcHandlers } = require('./ipcHandlers');
const backupScheduler = require('../backup/backupScheduler');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const APP_TITLE = process.env.APP_TITLE || 'Steam Manager';
const APP_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1200;
const APP_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 780;

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    minWidth: 980,
    minHeight: 680,
    title: APP_TITLE,
    backgroundColor: '#111827',
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.whenReady()
  .then(() => {
    initDatabase();
    setupIpcHandlers();
    backupScheduler.startBackupScheduler();
    createMainWindow();
  })
  .catch((error) => {
    console.error('Failed to start Steam Manager:', error);
  });
