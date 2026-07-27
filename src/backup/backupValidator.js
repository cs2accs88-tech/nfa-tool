function validateBackupPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    errors.push('Backup payload must be a JSON object.');
  }

  if (!payload.metadata || typeof payload.metadata !== 'object') {
    errors.push('Backup metadata is missing.');
  }

  if (!payload.data || typeof payload.data !== 'object') {
    errors.push('Backup data property is required.');
  }

  if (payload.data.accounts && !Array.isArray(payload.data.accounts)) {
    errors.push('Accounts section must be an array.');
  }

  if (payload.data.activityLogs && !Array.isArray(payload.data.activityLogs)) {
    errors.push('Activity log section must be an array.');
  }

  if (payload.metadata.scope && !['full', 'accounts-only', 'settings-only'].includes(payload.metadata.scope)) {
    errors.push('Backup scope is invalid.');
  }

  if (!payload.metadata.createdAt) {
    errors.push('Backup creation date is required.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateBackupPayload
};
