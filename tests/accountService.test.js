const assert = require('node:assert');
const { initDatabase, getDatabase } = require('../src/database/database');
const { createAccount, listAccounts, editAccount, findAccountBySteamId, removeAccount, searchAccounts, addNoteToAccount, bulkDelete } = require('../src/controllers/accountController');

function clearAccounts() {
  const db = getDatabase();
  db.prepare('DELETE FROM accounts').run();
  db.prepare('VACUUM').run();
}

describe('Account Controller', () => {
  before(() => {
    initDatabase();
    clearAccounts();
  });

  it('should add and retrieve an account', () => {
    const result = createAccount({
      steamId64: '76561198000000001',
      username: 'test_account',
      displayName: 'Test Account',
      profileUrl: 'https://steamcommunity.com/id/test_account',
      accountCreated: '2023-01-01T00:00:00Z',
      country: 'US',
      primeStatus: true,
      vacStatus: false,
      inventoryValue: 10.0,
      serviceMedals: 2,
      dateAdded: '2024-01-01T00:00:00Z',
      lastUpdated: '2024-01-01T00:00:00Z'
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.id);

    const accountResponse = findAccountBySteamId('76561198000000001');
    assert.strictEqual(accountResponse.success, true);
    assert.strictEqual(accountResponse.account.username, 'test_account');
  });

  it('should not create duplicate steam id', () => {
    const duplicateResult = createAccount({
      steamId64: '76561198000000001',
      username: 'test_account_duplicate',
      displayName: 'Test Account Duplicate',
      profileUrl: 'https://steamcommunity.com/id/test_account_duplicate',
      accountCreated: '2023-01-01T00:00:00Z',
      country: 'US',
      primeStatus: true,
      vacStatus: false,
      inventoryValue: 10.0,
      serviceMedals: 2,
      dateAdded: '2024-01-01T00:00:00Z',
      lastUpdated: '2024-01-01T00:00:00Z'
    });

    assert.strictEqual(duplicateResult.success, false);
  });

  it('should search accounts by username', () => {
    const searchResult = searchAccounts('test_account');
    assert.strictEqual(searchResult.success, true);
    assert.ok(Array.isArray(searchResult.accounts));
    assert.ok(searchResult.accounts.length >= 1);
  });

  it('should update account details', () => {
    const accountResponse = findAccountBySteamId('76561198000000001');
    assert.strictEqual(accountResponse.success, true);

    const updateResult = editAccount({
      id: accountResponse.account.id,
      steamId64: accountResponse.account.steamId64,
      username: 'updated_username',
      displayName: 'Updated Account',
      profileUrl: accountResponse.account.profileUrl,
      accountCreated: accountResponse.account.accountCreated,
      country: accountResponse.account.country,
      primeStatus: accountResponse.account.primeStatus,
      vacStatus: accountResponse.account.vacStatus,
      inventoryValue: accountResponse.account.inventoryValue,
      serviceMedals: accountResponse.account.serviceMedals,
      dateAdded: accountResponse.account.dateAdded,
      lastUpdated: new Date().toISOString()
    });

    assert.strictEqual(updateResult.success, true);
    assert.strictEqual(updateResult.changes, 1);
  });

  it('should delete the account', () => {
    const accountResponse = findAccountBySteamId('76561198000000001');
    assert.strictEqual(accountResponse.success, true);

    const deleteResult = removeAccount(accountResponse.account.id);
    assert.strictEqual(deleteResult.success, true);
    assert.strictEqual(deleteResult.changes, 1);
  });
});
