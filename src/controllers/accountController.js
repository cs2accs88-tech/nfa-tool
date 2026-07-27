const {
  getAllAccounts: serviceGetAllAccounts,
  getAccountById: serviceGetAccountById,
  getAccountBySteamId: serviceGetAccountBySteamId,
  createAccount: serviceCreateAccount,
  updateAccount: serviceUpdateAccount,
  deleteAccount: serviceDeleteAccount,
  searchAccounts: serviceSearchAccounts,
  filterAccounts: serviceFilterAccounts,
  sortAccounts: serviceSortAccounts,
  addAccountNote,
  bulkDeleteAccounts,
  bulkTagAccounts
} = require('../services/accountService');
const autosaveService = require('../autosave/autosaveService');
const {
  buildCreateChange,
  buildUpdateChange,
  buildDeleteChange,
  buildImportChange,
  buildRestoreChange
} = require('../autosave/changeTracker');

function formatResponse(success, data = null, error = null) {
  return {
    success,
    data,
    error,
    isEmpty: success && (!data || (Array.isArray(data) && data.length === 0))
  };
}

function listAccounts(options = {}) {
  return getAllAccounts(options);
}

function editAccount(account) {
  return updateAccount(account);
}

function removeAccount(id) {
  return deleteAccount(id);
}

function findAccountBySteamId(steamId64) {
  const result = serviceGetAccountBySteamId(steamId64);
  return result.success ? formatResponse(true, result.account) : formatResponse(false, null, result.error);
}

function getAllAccounts(options = {}) {
  return serviceGetAllAccounts(options);
}

function getAccountById(id) {
  return serviceGetAccountById(id);
}

async function createAccount(account) {
  const result = serviceCreateAccount(account);
  if (result.success) {
    try {
      await autosaveService.trackChange(buildCreateChange(result.id, account.steamId64, {
        description: 'Account created',
        origin: 'account'
      }));
    } catch (error) {
      // Autosave failures should not block the user action.
    }
  }
  return result;
}

async function updateAccount(account) {
  const existingResult = serviceGetAccountById(account.id);
  if (!existingResult.success || !existingResult.account) {
    return formatResponse(false, null, 'Account not found.');
  }

  if (account.lastUpdated && account.lastUpdated !== existingResult.account.lastUpdated) {
    return formatResponse(false, null, 'Conflict detected: the account has changed since the last fetch. Please refresh before saving.');
  }

  const result = serviceUpdateAccount(account);
  if (result.success) {
    try {
      await autosaveService.trackChange(buildUpdateChange(
        existingResult.account.id,
        existingResult.account.steamId64,
        'record',
        existingResult.account,
        account,
        {
          description: 'Account updated',
          origin: 'account'
        }
      ));
    } catch (error) {
      // ignore autosave tracking errors
    }
  }

  return result;
}

async function deleteAccount(id) {
  const existingResult = serviceGetAccountById(id);
  const result = serviceDeleteAccount(id);
  if (result.success && existingResult.success && existingResult.account) {
    try {
      await autosaveService.trackChange(buildDeleteChange(
        existingResult.account.id,
        existingResult.account.steamId64,
        {
          description: 'Account deleted',
          origin: 'account'
        }
      ));
    } catch (error) {
      // ignore autosave tracking errors
    }
  }

  return result;
}

function searchAccounts(query, options = {}) {
  return serviceSearchAccounts(query, options);
}

function filterAccounts(filters = {}, options = {}) {
  return serviceFilterAccounts(filters, options);
}

function sortAccounts(sortBy, sortOrder = 'DESC', options = {}) {
  return serviceSortAccounts(sortBy, sortOrder, options);
}

function addNoteToAccount(accountId, noteText) {
  return addAccountNote(accountId, noteText);
}

function bulkDelete(ids) {
  return bulkDeleteAccounts(ids);
}

function bulkAddTags(ids, tags, mode = 'add') {
  return bulkTagAccounts(ids, tags, mode);
}

module.exports = {
  getAllAccounts,
  listAccounts,
  getAccountById,
  getAccountBySteamId: findAccountBySteamId,
  createAccount,
  updateAccount,
  deleteAccount,
  editAccount,
  removeAccount,
  searchAccounts,
  filterAccounts,
  sortAccounts,
  addNoteToAccount,
  bulkDelete,
  bulkAddTags
};
