/**
 * @module main/index
 * @description Electron main process entry point.
 * Creates the application window, initializes the database,
 * registers IPC handlers, and manages the app lifecycle.
 *
 * When the user double-clicks the EXE:
 * 1. Show loading window
 * 2. Initialize database (create if missing, run migrations)
 * 3. Register IPC handlers
 * 4. Load main application UI
 * No terminal window appears.
 */

const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// Fix for blank/black window on machines with GPU driver/compositing issues.
// Rendering the whole window through software compositing is the standard,
// robust fix for Electron windows that stay blank despite the renderer running.
// Must be called before app is ready.
app.disableHardwareAcceleration();

// Ensure single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

/**
 * Gets the correct icon path.
 * @returns {string|undefined}
 */
function getIconPath() {
  // In packaged app, resources are at process.resourcesPath
  const paths = [
    path.join(__dirname, '..', '..', 'assets', 'icons', 'app.ico'),
    path.join(process.resourcesPath || '', 'icons', 'app.ico')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Loads environment and config modules (after app is ready).
 */
function loadConfig() {
  const { isDev } = require('../config/environment');
  const config = require('../config/production');
  return { isDev, config };
}

/**
 * Creates the main application window.
 */
function createWindow() {
  const { isDev, config } = loadConfig();

  mainWindow = new BrowserWindow({
    width: config.app.defaultWidth,
    height: config.app.defaultHeight,
    minWidth: config.app.minWidth,
    minHeight: config.app.minHeight,
    title: 'Steam Manager',
    icon: getIconPath(),
    show: false,
    frame: false, // Hide native OS title bar; use the custom in-app title bar only
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to work with contextBridge
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Remove default menu in production (no File/Edit/View menus)
  if (!isDev) {
    mainWindow.setMenu(null);
  }

  // Load the renderer HTML
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Show window when ready (prevents white flash). Fallback timer guarantees
  // the window is shown even if 'ready-to-show' never fires.
  let shown = false;
  const reveal = () => { if (!shown && mainWindow) { shown = true; mainWindow.show(); } };
  mainWindow.once('ready-to-show', reveal);
  mainWindow.webContents.once('did-finish-load', reveal);
  setTimeout(reveal, 3000);

  // Open DevTools in development only
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Registers core IPC handlers.
 */
function registerCoreHandlers() {
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getName', () => app.getName());
  ipcMain.handle('app:getDataPath', () => app.getPath('userData'));

  // Shell: open Steam profile URLs safely
  ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (typeof url !== 'string') return { success: false, error: 'Invalid URL' };
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return { success: false, error: 'Only HTTPS allowed' };
      if (!parsed.hostname.endsWith('steamcommunity.com')) {
        return { success: false, error: 'Only Steam URLs allowed' };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Clipboard
  ipcMain.handle('clipboard:write', (_event, text) => {
    if (typeof text !== 'string') return { success: false, error: 'Invalid text' };
    clipboard.writeText(text);
    return { success: true };
  });

  // Window controls
  ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => { mainWindow?.close(); });

  // Database status (for loading screen)
  ipcMain.handle('app:status', () => ({ ready: true, version: app.getVersion() }));
}

/**
 * Initializes the application — database, IPC handlers, crash handling.
 */
function initialize() {
  const { isDev } = loadConfig();

  try {
    // Initialize crash handling
    const { initCrashHandler } = require('./crashHandler');
    initCrashHandler();

    // Initialize database (creates file + folders if missing, runs migrations)
    const { initializeDatabase } = require('../database/database');
    initializeDatabase();

    // Register IPC handlers
    registerCoreHandlers();

    // Register profile link handlers
    const { registerProfileHandlers } = require('./profileIpcHandlers');
    registerProfileHandlers(ipcMain);

    // Register token import + account listing handlers
    const { registerTokenHandlers } = require('./tokenIpcHandlers');
    registerTokenHandlers(ipcMain, () => mainWindow);

    // Register local Steam client sign-in ("injection") handlers
    const { registerAuthHandlers } = require('./authIpcHandlers');
    registerAuthHandlers(ipcMain);

    // Register Account Status (token/VAC checking + dead-account cleanup)
    const { registerStatusHandlers } = require('./accountStatusIpcHandlers');
    registerStatusHandlers(ipcMain, () => mainWindow);

    // Register auto-update IPC (check/download/install/state/history/settings)
    const { registerUpdateHandlers } = require('./updateController');
    registerUpdateHandlers(ipcMain);

    if (isDev) {
      console.log('Steam Manager initialized successfully');
      console.log(`Data path: ${app.getPath('userData')}`);
    }
  } catch (error) {
    console.error('Failed to initialize:', error.message);
    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox('Steam Manager - Startup Error',
      `Failed to start the application.\n\n${error.message}\n\nPlease try reinstalling.`
    );
    app.quit();
  }
}

// ==================== App Lifecycle ====================

app.whenReady().then(() => {
  initialize();
  createWindow();

  // Auto-update: initialize AFTER the window exists so lifecycle events can be
  // forwarded to the renderer. Runs only in production (no-op otherwise) and
  // honors the user's auto-check preference. Failures here never block startup.
  try {
    const updateService = require('./updateService');
    updateService.initialize(() => mainWindow);
    updateService.startPeriodicChecks();
  } catch (err) {
    console.error('Update service init failed (non-fatal):', err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Second instance: focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    try {
      const { closeDatabase } = require('../database/database');
      closeDatabase();
    } catch { /* ignore */ }
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    const { closeDatabase } = require('../database/database');
    closeDatabase();
  } catch { /* ignore */ }
});

// Security: block all navigation and new windows. The main window only ever
// loads its local file, so any navigation attempt is blocked outright.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
