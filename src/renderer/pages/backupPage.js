import { createTopbar } from '../components/topbar.js';
import {
  listBackups,
  getBackupDetails,
  createBackup,
  deleteBackup,
  verifyBackup,
  restoreBackup,
  getBackupSettings,
  saveBackupSettings
} from '../scripts/api.js';

function createBackupHistoryTable(backups, onAction) {
  const section = document.createElement('div');
  section.className = 'card';
  section.innerHTML = `
    <h2>Backup History</h2>
    <div class="backup-summary">${backups.length} backup(s) available</div>
    <table class="backup-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Created</th>
          <th>Size</th>
          <th>Scope</th>
          <th>Automatic</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = section.querySelector('tbody');
  backups.forEach((backup) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${backup.name}</td>
      <td>${new Date(backup.createdAt).toLocaleString()}</td>
      <td>${(backup.size / 1024).toFixed(2)} KB</td>
      <td>${backup.scope}</td>
      <td>${backup.automatic ? 'Yes' : 'No'}</td>
      <td class="backup-actions"></td>
    `;

    const actionsCell = row.querySelector('.backup-actions');
    const verifyButton = document.createElement('button');
    verifyButton.type = 'button';
    verifyButton.className = 'button tertiary small';
    verifyButton.textContent = 'Verify';
    verifyButton.addEventListener('click', () => onAction('verify', backup.name));

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'button secondary small';
    restoreButton.textContent = 'Restore';
    restoreButton.addEventListener('click', () => onAction('restore', backup.name));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'button small';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => onAction('delete', backup.name));

    actionsCell.appendChild(verifyButton);
    actionsCell.appendChild(restoreButton);
    actionsCell.appendChild(deleteButton);
    tbody.appendChild(row);
  });

  return section;
}

function createBackupSettingsSection(settings, onSave) {
  const section = document.createElement('div');
  section.className = 'card';
  section.innerHTML = `
    <h2>Backup Settings</h2>
    <div class="filter-panel backup-settings-panel">
      <label>
        Enable automatic backups
        <select name="enabled">
          <option value="true" ${settings.enabled ? 'selected' : ''}>Enabled</option>
          <option value="false" ${settings.enabled ? '' : 'selected'}>Disabled</option>
        </select>
      </label>
      <label>
        Schedule
        <select name="schedule">
          <option value="manual" ${settings.schedule === 'manual' ? 'selected' : ''}>Manual only</option>
          <option value="daily" ${settings.schedule === 'daily' ? 'selected' : ''}>Daily</option>
          <option value="weekly" ${settings.schedule === 'weekly' ? 'selected' : ''}>Weekly</option>
        </select>
      </label>
      <label>
        Keep backups
        <input type="number" name="maxBackups" min="1" value="${settings.maxBackups}" />
      </label>
      <label>
        Compress backups
        <select name="compress">
          <option value="true" ${settings.compress ? 'selected' : ''}>Yes</option>
          <option value="false" ${settings.compress ? '' : 'selected'}>No</option>
        </select>
      </label>
    </div>
    <div class="backup-actions-row">
      <button class="button" id="save-backup-settings">Save Settings</button>
    </div>
  `;

  section.querySelector('#save-backup-settings').addEventListener('click', () => {
    const values = {
      enabled: section.querySelector('[name="enabled"]').value === 'true',
      schedule: section.querySelector('[name="schedule"]').value,
      maxBackups: Number(section.querySelector('[name="maxBackups"]').value) || 1,
      compress: section.querySelector('[name="compress"]').value === 'true'
    };
    onSave(values);
  });

  return section;
}

export async function renderBackupPage(container) {
  const topbar = createTopbar('Backups', () => {}, () => {}, () => {});
  container.appendChild(topbar);

  const messagePanel = document.createElement('div');
  messagePanel.id = 'backup-message-panel';
  container.appendChild(messagePanel);

  const actionCard = document.createElement('div');
  actionCard.className = 'card';
  actionCard.innerHTML = `
    <h2>Backup Control</h2>
    <p>Run a manual backup or manage your automatic schedule and retention policy.</p>
    <div class="backup-actions-row">
      <button class="button" id="create-backup">Create Manual Backup</button>
      <button class="button secondary" id="refresh-backups">Refresh List</button>
    </div>
  `;

  container.appendChild(actionCard);

  const backupSettingsContainer = document.createElement('div');
  const backupHistoryContainer = document.createElement('div');
  container.appendChild(backupSettingsContainer);
  container.appendChild(backupHistoryContainer);

  async function showMessage(message, type = 'info') {
    messagePanel.innerHTML = `<div class="notification ${type}">${message}</div>`;
    setTimeout(() => {
      messagePanel.innerHTML = '';
    }, 7000);
  }

  async function loadPage() {
    const settingsResult = await getBackupSettings();
    if (!settingsResult.success) {
      showMessage(`Could not load backup settings: ${settingsResult.error}`, 'error');
      return;
    }

    const historyResult = await listBackups();
    if (!historyResult.success) {
      showMessage(`Could not load backup history: ${historyResult.error}`, 'error');
      return;
    }

    backupSettingsContainer.innerHTML = '';
    backupHistoryContainer.innerHTML = '';

    backupSettingsContainer.appendChild(createBackupSettingsSection(settingsResult.data, async (settings) => {
      const saveResult = await saveBackupSettings(settings);
      if (saveResult.success) {
        showMessage('Backup settings saved successfully.');
        await loadPage();
      } else {
        showMessage(`Failed to save backup settings: ${saveResult.error}`, 'error');
      }
    }));

    backupHistoryContainer.appendChild(createBackupHistoryTable(historyResult.data, async (action, name) => {
      if (action === 'verify') {
        const result = await verifyBackup(name);
        if (result.success) {
          showMessage(`Backup verified: ${name}`);
        } else {
          showMessage(`Verification error: ${result.error}`, 'error');
        }
      }

      if (action === 'delete') {
        const result = await deleteBackup(name);
        if (result.success) {
          showMessage(`Deleted backup ${name}`);
          await loadPage();
        } else {
          showMessage(`Delete failed: ${result.error}`, 'error');
        }
      }

      if (action === 'restore') {
        const confirmed = confirm('This will restore the application state from the backup and may overwrite current data. Proceed?');
        if (!confirmed) {
          return;
        }
        const result = await restoreBackup(name);
        if (result.success) {
          showMessage('Restore completed successfully. Restart the application to apply restored data.');
        } else {
          showMessage(`Restore failed: ${result.error}`, 'error');
        }
      }
    }));
  }

  actionCard.querySelector('#create-backup').addEventListener('click', async () => {
    const result = await createBackup({
      scope: 'full',
      compressed: true,
      automatic: false,
      type: 'manual'
    });

    if (result.success) {
      showMessage(`Backup created: ${result.data.backup.name}`);
      await loadPage();
    } else {
      showMessage(`Failed to create backup: ${result.error}`, 'error');
    }
  });

  actionCard.querySelector('#refresh-backups').addEventListener('click', loadPage);
  await loadPage();
}
