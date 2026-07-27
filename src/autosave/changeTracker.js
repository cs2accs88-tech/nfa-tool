const ACTION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  IMPORT: 'IMPORT',
  RESTORE: 'RESTORE'
};

function normalizeValue(value) {
  if (value === undefined) {
    return null;
  }

  try {
    return typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
  } catch {
    return String(value);
  }
}

function createChange({
  action,
  accountId = null,
  accountSteamId = null,
  field = null,
  oldValue = null,
  newValue = null,
  metadata = {}
}) {
  if (!Object.values(ACTION_TYPES).includes(action)) {
    throw new Error(`Invalid change action: ${action}`);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    accountId,
    accountSteamId,
    field,
    oldValue: normalizeValue(oldValue),
    newValue: normalizeValue(newValue),
    changedAt: new Date().toISOString(),
    metadata: {
      origin: metadata.origin || 'application',
      description: metadata.description || null,
      ...metadata
    }
  };
}

function summarizeChange(change) {
  return `${change.action} ${change.field || 'record'} for account ${change.accountId || change.accountSteamId || 'unknown'} at ${change.changedAt}`;
}

function buildUpdateChange(accountId, accountSteamId, field, oldValue, newValue, metadata = {}) {
  return createChange({
    action: ACTION_TYPES.UPDATE,
    accountId,
    accountSteamId,
    field,
    oldValue,
    newValue,
    metadata
  });
}

function buildCreateChange(accountId, accountSteamId, metadata = {}) {
  return createChange({
    action: ACTION_TYPES.CREATE,
    accountId,
    accountSteamId,
    metadata
  });
}

function buildDeleteChange(accountId, accountSteamId, metadata = {}) {
  return createChange({
    action: ACTION_TYPES.DELETE,
    accountId,
    accountSteamId,
    metadata
  });
}

function buildImportChange(accountSteamId, metadata = {}) {
  return createChange({
    action: ACTION_TYPES.IMPORT,
    accountSteamId,
    metadata
  });
}

function buildRestoreChange(accountSteamId, metadata = {}) {
  return createChange({
    action: ACTION_TYPES.RESTORE,
    accountSteamId,
    metadata
  });
}

module.exports = {
  ACTION_TYPES,
  createChange,
  summarizeChange,
  buildUpdateChange,
  buildCreateChange,
  buildDeleteChange,
  buildImportChange,
  buildRestoreChange
};
