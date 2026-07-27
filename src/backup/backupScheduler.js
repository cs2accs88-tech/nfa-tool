const { getBackupSettings, createBackup, listBackups, saveBackupSettings } = require('./backupService');

let scheduler = null;

function getIntervalFromSchedule(schedule) {
  switch (schedule) {
    case 'daily':
      return 24 * 60 * 60 * 1000;
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function cleanupOldBackups() {
  const settings = getBackupSettings();
  if (!Number.isFinite(settings.maxBackups)) {
    return;
  }

  const backups = listBackups();
  if (backups.length <= settings.maxBackups) {
    return;
  }

  const oldBackups = backups.slice(settings.maxBackups);
  oldBackups.forEach((backup) => {
    try {
      require('./backupService').deleteBackup(backup.name);
    } catch {
      // ignore cleanup errors
    }
  });
}

function runAutomaticBackup() {
  const settings = getBackupSettings();
  if (!settings.enabled || settings.schedule === 'manual') {
    return;
  }

  createBackup({
    scope: 'full',
    type: 'automatic',
    description: `Scheduled ${settings.schedule} backup`,
    compressed: settings.compress,
    automatic: true
  }).then(() => cleanupOldBackups()).catch(() => {
    // log or ignore automatic backup failures
  });
}

function startBackupScheduler() {
  const settings = getBackupSettings();
  stopBackupScheduler();

  const interval = getIntervalFromSchedule(settings.schedule);
  if (!settings.enabled || !interval) {
    return;
  }

  scheduler = setInterval(() => {
    runAutomaticBackup();
  }, interval);
}

function stopBackupScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}

function updateBackupSchedule(settings) {
  saveBackupSettings(settings);
  startBackupScheduler();
}

module.exports = {
  startBackupScheduler,
  stopBackupScheduler,
  updateBackupSchedule,
  cleanupOldBackups
};
