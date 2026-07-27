const {
  createAccount,
  listAccounts,
  editAccount,
  removeAccount,
  searchAccounts
} = require('../controllers/accountController');

async function runExample() {
  console.log('Adding account...');
  const addResult = createAccount({
    steamId64: '76561198000000000',
    username: 'example_user',
    displayName: 'Example User',
    profileUrl: 'https://steamcommunity.com/id/example_user',
    accountCreated: '2020-01-01T00:00:00Z',
    country: 'US',
    primeStatus: true,
    vacStatus: false,
    serviceMedals: 12,
    inventoryValue: 245.75,
    lastChecked: new Date().toISOString(),
    notes: 'Test account entry',
    tags: 'test, beginner'
  });

  if (!addResult.success) {
    console.error('Failed to add account:', addResult.error);
    return;
  }

  console.log('Added account ID:', addResult.id);

  console.log('Viewing accounts...');
  const viewResult = listAccounts();
  if (viewResult.success) {
    console.log(viewResult.accounts);
  } else {
    console.error('Failed to load accounts:', viewResult.error);
  }

  console.log('Searching accounts...');
  const searchResult = searchAccounts('example');
  if (searchResult.success) {
    console.log(searchResult.accounts);
  } else {
    console.error('Search failed:', searchResult.error);
  }

  console.log('Updating account...');
  const updateResult = editAccount({
    id: addResult.id,
    steamId64: '76561198000000000',
    username: 'example_user',
    displayName: 'Example User Updated',
    profileUrl: 'https://steamcommunity.com/id/example_user_updated',
    accountCreated: '2020-01-01T00:00:00Z',
    country: 'US',
    primeStatus: true,
    vacStatus: false,
    serviceMedals: 15,
    inventoryValue: 300.00,
    lastChecked: new Date().toISOString(),
    notes: 'Updated test account',
    tags: 'test, updated'
  });

  if (!updateResult.success) {
    console.error('Failed to update account:', updateResult.error);
    return;
  }

  console.log('Update changes:', updateResult.changes);

  console.log('Deleting account...');
  const deleteResult = removeAccount(addResult.id);
  if (!deleteResult.success) {
    console.error('Failed to delete account:', deleteResult.error);
    return;
  }

  console.log('Delete changes:', deleteResult.changes);
}

runExample();
