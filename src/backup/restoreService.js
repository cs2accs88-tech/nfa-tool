const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/database');
const { createBackup, readBackupFile } = require('./backupService');
const { validateBackupPayload } = require('./backupValidator');

function restoreSettingsFile(settings) {
  const settingsPath = path.join(__dirname, 'backupSettings.json');
  if (settings && typeof settings === 'object') {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
}

function restoreConfigFiles(files) {
  const configDir = path.join(__dirname, '..', 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  Object.entries(files || {}).forEach(([name, contents]) => {
    const filePath = path.join(configDir, name);
    fs.writeFileSync(filePath, contents, 'utf8');
  });
}

function clearTable(db, tableName) {
  db.prepare(`DELETE FROM ${tableName}`).run();
  db.prepare(`VACUUM`).run();
}

function restoreDatabaseData(payload) {
  const db = getDatabase();
  const transaction = db.transaction(() => {
    clearTable(db, 'accounts');
    clearTable(db, 'activity_logs');

    const accountInsert = db.prepare(`
      INSERT INTO accounts (
        steamId64,
        username,
        displayName,
        profileUrl,
        accountCreated,
        country,
        notes,
        competitiveRank,
        premierRating,
        level,
        xp,
        hoursPlayed,
        lastGamePlayed,
        primeStatus,
        vacStatus,
        gameBanStatus,
        tradeRestrictionStatus,
        communityBanStatus,
        cooldownStatus,
        verificationStatus,
        inventoryValue,
        inventoryItems,
        rareItems,
        inventoryPrivacy,
        lastInventoryUpdate,
        serviceMedals,
        medalList,
        achievementCount,
        specialBadges,
        dateAdded,
        lastUpdated,
        lastChecked,
        checkHistory,
        changesLog,
        tags
      ) VALUES (
        @steamId64,
        @username,
        @displayName,
        @profileUrl,
        @accountCreated,
        @country,
        @notes,
        @competitiveRank,
        @premierRating,
        @level,
        @xp,
        @hoursPlayed,
        @lastGamePlayed,
        @primeStatus,
        @vacStatus,
        @gameBanStatus,
        @tradeRestrictionStatus,
        @communityBanStatus,
        @cooldownStatus,
        @verificationStatus,
        @inventoryValue,
        @inventoryItems,
        @rareItems,
        @inventoryPrivacy,
        @lastInventoryUpdate,
        @serviceMedals,
        @medalList,
        @achievementCount,
        @specialBadges,
        @dateAdded,
        @lastUpdated,
        @lastChecked,
        @checkHistory,
        @changesLog,
        @tags
      )
    `);

    const activityInsert = db.prepare(`
      INSERT INTO activity_logs (
        accountId,
        accountName,
        action,
        details,
        createdAt
      ) VALUES (
        @accountId,
        @accountName,
        @action,
        @details,
        @createdAt
      )
    `);

    (payload.data.accounts || []).forEach((account) => accountInsert.run(account));
    (payload.data.activityLogs || []).forEach((log) => activityInsert.run(log));
  });

  transaction();
}

async function restoreBackup(name) {
  const backupPath = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'Backup file does not exist.' };
  }

  const payload = readBackupFile(name);
  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  await createBackup({
    scope: 'full',
    type: 'emergency',
    description: 'Emergency restore snapshot',
    compressed: false,
    automatic: false
  });

  try {
    if (payload.data.settings) {
      restoreSettingsFile(payload.data.settings);
    }

    if (payload.data.files) {
      restoreConfigFiles(payload.data.files);
    }

    if (payload.data.accounts || payload.data.activityLogs) {
      restoreDatabaseData(payload);
    }

    return {
      success: true,
      message: 'Restore completed. Restart the application to reload restored data.'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  restoreBackup
};
