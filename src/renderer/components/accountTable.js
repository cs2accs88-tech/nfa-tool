export function createAccountGrid(accounts, onAction) {
  const container = document.createElement('div');
  container.className = 'account-grid';

  accounts.forEach((account) => {
    const card = document.createElement('article');
    card.className = 'account-card';

    const title = account.username || 'Unknown Account';
    const subtitle = account.accountStatus || 'Secure';
    const inventoryValue = account.inventoryValue != null ? `$${Number(account.inventoryValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Unknown';
    const guardLabel = account.steamGuardStatus || (account.primeStatus ? 'Steam Guard: Mobile Authenticator' : 'Steam Guard: Enabled');
    const tradingStatus = account.tradingStatus || 'Trading: Active | Market Listed Items';
    const tagList = Array.isArray(account.tags) ? account.tags : account.tags ? account.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];

    const initials = title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-block">
          <div class="avatar">${initials}</div>
          <div>
            <h2>${title}</h2>
            <p class="card-subtitle">${subtitle}</p>
          </div>
        </div>
        <button type="button" class="icon-button favorite-button" title="Favorite">
          <span>★</span>
        </button>
      </div>

      <div class="card-content">
        <div class="status-row">
          <span class="status-pill ${account.primeStatus ? 'success' : 'neutral'}">${account.primeStatus ? 'Prime' : 'Standard'}</span>
          <span class="status-pill ${account.vacStatus ? 'danger' : 'success'}">${account.vacStatus ? 'VAC Ban' : 'No Bans'}</span>
          <span class="status-pill secondary">${account.gameBanStatus ? 'Game Ban' : 'No Game Bans'}</span>
        </div>

        <div class="card-stat-row">
          <div>
            <span class="stat-label">Inventory value</span>
            <strong>${inventoryValue}</strong>
          </div>
          <div>
            <span class="stat-label">Status</span>
            <strong>${tradingStatus}</strong>
          </div>
        </div>

        <div class="card-summary">
          <p>${guardLabel}</p>
          <p>${account.notes || 'No notes available'}</p>
        </div>

        <div class="tag-row">
          ${tagList.map((tag) => `<span class="tag-pill">${tag}</span>`).join('')}
        </div>
      </div>

      <div class="card-actions">
        <button type="button" class="button ghost" data-action="view">View</button>
        <button type="button" class="button ghost" data-action="edit">Edit</button>
        <button type="button" class="button secondary ghost" data-action="delete">Delete</button>
        <button type="button" class="icon-button more-button" title="More actions">⋯</button>
      </div>
    `;

    card.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => onAction(button.dataset.action, account));
    });

    container.appendChild(card);
  });

  return container;
}
