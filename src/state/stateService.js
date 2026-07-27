const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'app_state.json');
const DEFAULT_STATE = {
  currentPage: 'dashboard',
  selectedAccountId: null,
  activeFilters: {},
  searchText: '',
  uiPreferences: {
    compactView: false,
    theme: 'dark'
  },
  lastRestoredAt: null,
  lastSavedAt: null
};

function ensureStateFile() {
  const folder = path.dirname(STATE_FILE);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }
}

function loadState() {
  ensureStateFile();
  try {
    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const rawState = JSON.parse(content);
    return { ...DEFAULT_STATE, ...rawState };
  } catch (error) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
    return { ...DEFAULT_STATE };
  }
}

function saveState(state = {}) {
  const normalized = { ...DEFAULT_STATE, ...loadState(), ...state, lastSavedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function updateState(partialState = {}) {
  const current = loadState();
  return saveState({ ...current, ...partialState });
}

function resetState() {
  saveState(DEFAULT_STATE);
}

module.exports = {
  loadState,
  saveState,
  updateState,
  resetState
};
