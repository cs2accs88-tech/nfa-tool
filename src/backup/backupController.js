const {
  createBackup,
  listBackups,
  getBackupDetails,
  deleteBackup,
  verifyBackup,
  getBackupSettings,
  saveBackupSettings
} = require('./backupService');
const backupScheduler = require('./backupScheduler');
const { restoreBackup } = require('./restoreService');

function formatResponse(success, data = null, error = null) {
  return { success, data, error };
}

function getBackups() {
  try {
    const data = listBackups();
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

async function getBackupDetailsController(name) {
  try {
    const data = await getBackupDetails(name);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

async function createBackupController(options = {}) {
  try {
    const data = await createBackup(options);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function deleteBackupController(name) {
  try {
    const data = deleteBackup(name);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

async function verifyBackupController(name) {
  try {
    const data = await verifyBackup(name);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

async function restoreBackupController(name) {
  try {
    const data = await restoreBackup(name);
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function getBackupSettingsController() {
  try {
    const data = getBackupSettings();
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

function saveBackupSettingsController(settings) {
  try {
    const data = saveBackupSettings(settings);
    backupScheduler.startBackupScheduler();
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, null, error.message);
  }
}

module.exports = {
  getBackups,
  getBackupDetails: getBackupDetailsController,
  createBackup: createBackupController,
  deleteBackup: deleteBackupController,
  verifyBackup: verifyBackupController,
  restoreBackup: restoreBackupController,
  getBackupSettings: getBackupSettingsController,
  saveBackupSettings: saveBackupSettingsController
};
