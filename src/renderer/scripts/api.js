export async function loadAccounts(options = {}) {
  return window.steamManager.api.loadAccounts(options);
}

export async function searchAccounts(query, options = {}) {
  return window.steamManager.api.searchAccounts(query, options);
}

export async function getAccount(id) {
  return window.steamManager.api.getAccount(id);
}

export async function addAccount(account) {
  return window.steamManager.api.addAccount(account);
}

export async function updateAccount(account) {
  return window.steamManager.api.updateAccount(account);
}

export async function deleteAccount(id) {
  return window.steamManager.api.deleteAccount(id);
}

export async function addAccountNote(accountId, noteText) {
  return window.steamManager.api.addAccountNote(accountId, noteText);
}

export async function bulkDeleteAccounts(ids) {
  return window.steamManager.api.bulkDeleteAccounts(ids);
}

export async function bulkTagAccounts(ids, tags, mode = 'add') {
  return window.steamManager.api.bulkTagAccounts(ids, tags, mode);
}

export async function getDashboardStats(filters = {}) {
  return window.steamManager.api.getDashboardStats(filters);
}

export async function exportStatisticsJson(filters = {}) {
  return window.steamManager.api.exportStatisticsJson(filters);
}

export async function exportStatisticsCsv(filters = {}) {
  return window.steamManager.api.exportStatisticsCsv(filters);
}

export async function clearStatisticsCache() {
  return window.steamManager.api.clearStatisticsCache();
}

export async function loadState() {
  return window.steamManager.api.loadState();
}

export async function updateState(stateUpdate) {
  return window.steamManager.api.updateState(stateUpdate);
}

export async function getAutosaveState() {
  return window.steamManager.api.getAutosaveState();
}

export async function updateAutosaveSettings(settings = {}) {
  return window.steamManager.api.updateAutosaveSettings(settings);
}

export async function listBackups() {
  return window.steamManager.api.listBackups();
}

export async function getBackupDetails(name) {
  return window.steamManager.api.getBackupDetails(name);
}

export async function createBackup(options = {}) {
  return window.steamManager.api.createBackup(options);
}

export async function deleteBackup(name) {
  return window.steamManager.api.deleteBackup(name);
}

export async function verifyBackup(name) {
  return window.steamManager.api.verifyBackup(name);
}

export async function restoreBackup(name) {
  return window.steamManager.api.restoreBackup(name);
}

export async function getBackupSettings() {
  return window.steamManager.api.getBackupSettings();
}

export async function saveBackupSettings(settings = {}) {
  return window.steamManager.api.saveBackupSettings(settings);
}
