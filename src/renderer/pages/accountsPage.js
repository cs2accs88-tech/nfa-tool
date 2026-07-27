import { createTopbar } from '../components/topbar.js';
import { createAccountGrid } from '../components/accountTable.js';
import { createFilterPanel } from '../components/filterPanel.js';
import { loadAccounts, searchAccounts, deleteAccount, openProfile } from '../scripts/api.js';

function renderEmptyState(container) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.innerHTML = `
    <p><strong>No accounts found.</strong></p>
    <p>Use the import page or add new accounts to start managing Steam data.</p>
  `;
  container.appendChild(empty);
}

function getFilterOptions(filterPanel) {
  const values = {};
  const primeStatus = filterPanel.querySelector('[name="primeStatus"]').value;
  const vacStatus = filterPanel.querySelector('[name="vacStatus"]').value;
  const rankMin = filterPanel.querySelector('[name="rankMin"]').value;
  const rankMax = filterPanel.querySelector('[name="rankMax"]').value;
  const inventoryMin = filterPanel.querySelector('[name="inventoryMin"]').value;
  const inventoryMax = filterPanel.querySelector('[name="inventoryMax"]').value;

  if (primeStatus === 'prime') values.primeStatus = true;
  if (primeStatus === 'standard') values.primeStatus = false;
  if (vacStatus === 'banned') values.vacStatus = true;
  if (vacStatus === 'clean') values.vacStatus = false;
  if (rankMin) values.rankMin = Number(rankMin);
  if (rankMax) values.rankMax = Number(rankMax);
  if (inventoryMin) values.inventoryMin = Number(inventoryMin);
  if (inventoryMax) values.inventoryMax = Number(inventoryMax);

  return values;
}

export async function renderAccountsPage(container) {
  const filterPanel = createFilterPanel(handleFilterUpdate);
  const topbar = createTopbar('Accounts', handleSearch, () => {
    filterPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, () => {
    alert('Report generation will be available soon.');
  });
  container.appendChild(topbar);

  container.appendChild(filterPanel);

  const gridContainer = document.createElement('div');
  gridContainer.className = 'page-grid';
  container.appendChild(gridContainer);

  let currentQuery = '';

  async function refreshGrid() {
    const options = {
      filters: getFilterOptions(filterPanel)
    };

    const result = currentQuery ? await searchAccounts(currentQuery, options) : await loadAccounts(options);
    gridContainer.innerHTML = '';

    if (!result.success || result.accounts.length === 0) {
      renderEmptyState(gridContainer);
      return;
    }

    gridContainer.appendChild(createAccountGrid(result.accounts, handleAction));
  }

  await refreshGrid();

  async function handleSearch(query) {
    currentQuery = query.trim();
    await refreshGrid();
  }

  async function handleFilterUpdate() {
    await refreshGrid();
  }

  async function handleAction(action, account) {
    if (action === 'delete') {
      const confirmation = window.confirm(`Delete ${account.username}?`);
      if (!confirmation) {
        return;
      }
      await deleteAccount(account.id);
      await refreshGrid();
      return;
    }

    if (action === 'openProfile') {
      await openProfile(account.profileUrl);
      return;
    }

    if (action === 'view') {
      alert(`View account details for ${account.username}`);
      return;
    }

    if (action === 'edit') {
      alert(`Edit account ${account.username} will be supported in the next update.`);
      return;
    }
  }
}
