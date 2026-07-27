const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getDatabase } = require('../database/database');
const { validateBackupPayload } = require('./backupValidator');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const SETTINGS_FILE = path.join(__dirname, 'backupSettings.json');
const DEFAULT_SETTINGS = {
  enabled: false,
  schedule: 'manual',
  backupFolder: BACKUP_DIR,
  maxBackups: 12,
  compress: true,
  createdAt: new Date().toISOString()
};

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function ensureSettingsFile() {
  ensureFolder(BACKUP_DIR);
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function getBackupSettings() {
  ensureSettingsFile();
  const raw = readJsonFile(SETTINGS_FILE) || {};
  return { ...DEFAULT_SETTINGS, ...raw };
}

function saveBackupSettings(settings) {
  const current = getBackupSettings();
  const normalized = { ...current, ...settings, updatedAt: new Date().toISOString() };
  writeJsonFile(SETTINGS_FILE, normalized);
  return normalized;
}

function createBackupMetadata({ name, type, scope, method, size, format, automatic }) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    type,
    scope,
    method,
    format,
    automatic: Boolean(automatic),
    createdAt: new Date().toISOString(),
    size,
    verified: true
  };
}

function serializeConfigFiles() {
  const configDirectory = path.join(__dirname, '..', 'config');
  const configFiles = {};

  if (fs.existsSync(configDirectory)) {
    const files = fs.readdirSync(configDirectory);
    files.forEach((filename) => {
      const filePath = path.join(configDirectory, filename);
      if (fs.lstatSync(filePath).isFile()) {
        configFiles[filename] = fs.readFileSync(filePath, 'utf8');
      }
    });
  }

  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    configFiles['.env'] = fs.readFileSync(envPath, 'utf8');
  }

  return configFiles;
}

function fetchDatabasePayload() {
  const db = getDatabase();
  const accounts = db.prepare('SELECT * FROM accounts').all();
  const activityLogs = db.prepare('SELECT * FROM activity_logs').all();
  return { accounts, activityLogs };
}

function buildBackupPayload(options = {}) {
  const settings = getBackupSettings();
  const payload = {
    metadata: {
      createdAt: new Date().toISOString(),
      scope: options.scope || 'full',
      type: options.type || 'manual',
      method: options.method || 'json',
      automatic: Boolean(options.automatic),
      description: options.description || null
    },
    data: {
      settings: options.includeSettings !== false ? settings : {},
      files: options.includeFiles !== false ? serializeConfigFiles() : {}
    }
  };

  if (options.scope !== 'settings-only') {
    const dbPayload = fetchDatabasePayload();
    payload.data.accounts = dbPayload.accounts;
    payload.data.activityLogs = dbPayload.activityLogs;
  }

  if (options.scope === 'accounts-only') {
    payload.data.settings = {};
    payload.data.files = {};
  }

  return payload;
}

function buildBackupName({ createdAt, scope, method }) {
  const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
  const suffix = method === 'gzip' ? 'json.gz' : 'json';
  return `backup_${scope}_${timestamp}.${suffix}`;
}

function getBackupFolder() {
  const settings = getBackupSettings();
  return settings.backupFolder || BACKUP_DIR;
}

function getBackupHistoryFilePath() {
  const folder = getBackupFolder();
  ensureFolder(folder);
  const historyFile = path.join(folder, 'backup_history.json');
  if (!fs.existsSync(historyFile)) {
    writeJsonFile(historyFile, []);
  }
  return historyFile;
}

function readBackupHistory() {
  const historyFile = getBackupHistoryFilePath();
  return readJsonFile(historyFile) || [];
}

function saveBackupHistoryEntry(entry) {
  const historyFile = getBackupHistoryFilePath();
  const history = readJsonFile(historyFile) || [];
  history.unshift(entry);
  writeJsonFile(historyFile, history.slice(0, 100));
}

async function writeBackupFile(filePath, content, compressed) {
  ensureFolder(path.dirname(filePath));
  if (compressed) {
    const buffer = Buffer.from(content, 'utf8');
    const compressedBuffer = zlib.gzipSync(buffer);
    await fs.promises.writeFile(filePath, compressedBuffer);
    return compressedBuffer.length;
  }

  await fs.promises.writeFile(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

async function createBackup(options = {}) {
  ensureFolder(BACKUP_DIR);
  ensureSettingsFile();

  const settings = getBackupSettings();
  const backupScope = options.scope || 'full';
  const backupMethod = options.compressed ? 'gzip' : 'json';
  const payload = buildBackupPayload({
    scope: backupScope,
    type: options.type || (options.automatic ? 'automatic' : 'manual'),
    method: backupMethod,
    automatic: options.automatic || false,
    description: options.description,
    includeSettings: options.includeSettings !== false,
    includeFiles: options.includeFiles !== false
  });

  const payloadJson = JSON.stringify(payload, null, 2);
  const name = buildBackupName({ createdAt: payload.metadata.createdAt, scope: backupScope, method: backupMethod });
  const filePath = path.join(settings.backupFolder || BACKUP_DIR, name);
  const size = await writeBackupFile(filePath, payloadJson, options.compressed);

  const metadata = createBackupMetadata({
    name,
    type: payload.metadata.type,
    scope: payload.metadata.scope,
    method: payload.metadata.method,
    size,
    format: backupMethod,
    automatic: payload.metadata.automatic
  });

  saveBackupHistoryEntry(metadata);
  enforceMaxBackups(settings.maxBackups);
  return { success: true, backup: metadata, filePath };
}

function normalizeBackupEntry(filename, metadata) {
  const folder = getBackupFolder();
  const filePath = path.join(folder, filename);
  const stats = fs.statSync(filePath);
  return {
    name: filename,
    createdAt: metadata?.createdAt || stats.birthtime.toISOString(),
    size: metadata?.size || stats.size,
    automatic: metadata?.automatic || false,
    scope: metadata?.scope || 'full',
    method: metadata?.method || 'json',
    verified: metadata?.verified !== false,
    filePath
  };
}

function listBackups() {
  const folder = getBackupFolder();
  ensureFolder(folder);
  const history = readBackupHistory();
  const backups = [];
  const files = fs.readdirSync(folder).filter((name) => name !== 'backup_history.json');

  files.forEach((filename) => {
    try {
      const metadata = history.find((item) => item.name === filename);
      backups.push(normalizeBackupEntry(filename, metadata));
    } catch {
      // ignore invalid entries
    }
  });

  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBackupFilePath(name) {
  const folder = getBackupFolder();
  return path.join(folder, name);
}

function detectBackupFormat(name) {
  if (name.endsWith('.json.gz')) {
    return 'gzip';
  }
  if (name.endsWith('.json')) {
    return 'json';
  }
  return null;
}

function readBackupFile(name) {
  const filePath = getBackupFilePath(name);
  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file not found');
  }

  const buffer = fs.readFileSync(filePath);
  const format = detectBackupFormat(name);
  if (format === 'gzip') {
    const uncompressed = zlib.gunzipSync(buffer).toString('utf8');
    return JSON.parse(uncompressed);
  }

  return JSON.parse(buffer.toString('utf8'));
}

function getBackupDetails(name) {
  const payload = readBackupFile(name);
  const fileStats = fs.statSync(getBackupFilePath(name));
  return {
    metadata: payload.metadata,
    file: {
      name,
      size: fileStats.size,
      path: getBackupFilePath(name),
      createdAt: fileStats.birthtime.toISOString()
    }
  };
}

function deleteBackup(name) {
  const filePath = getBackupFilePath(name);
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Backup file not found' };
  }

  fs.unlinkSync(filePath);
  const history = readBackupHistory().filter((entry) => entry.name !== name);
  writeJsonFile(getBackupHistoryFilePath(), history);
  return { success: true };
}

function verifyBackup(name) {
  try {
    const payload = readBackupFile(name);
    const validation = validateBackupPayload(payload);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; ') };
    }
    return { success: true, metadata: payload.metadata };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function enforceMaxBackups(maxBackups) {
  const backups = listBackups();
  if (backups.length <= maxBackups) {
    return;
  }

  const expired = backups.slice(maxBackups);
  expired.forEach((entry) => {
    try {
      fs.unlinkSync(entry.filePath);
    } catch {
      // ignore deletion errors
    }
  });
}

module.exports = {
  createBackup,
  listBackups,
  getBackupDetails,
  deleteBackup,
  verifyBackup,
  getBackupSettings,
  saveBackupSettings,
  getBackupFilePath,
  BACKUP_DIR
};
