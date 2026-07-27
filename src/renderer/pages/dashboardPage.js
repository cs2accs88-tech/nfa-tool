import { createTopbar } from '../components/topbar.js';

function renderOverviewCard(label, value) {
  const card = document.createElement('div');
  card.className = 'card dashboard-card';
  card.innerHTML = `
    <div class="label">${label}</div>
    <div class="value">${value}</div>
  `;
  return card;
}

export function renderDashboardPage(container, { navigate } = {}) {
  const topbar = createTopbar('Dashboard', () => {}, () => {}, () => {});
  container.appendChild(topbar);

  const headerCard = document.createElement('div');
  headerCard.className = 'card';
  headerCard.innerHTML = `
    <h2>Welcome to Steam Manager</h2>
    <p>Monitor your Steam accounts, import new records, and keep your data in sync with a clean desktop workflow.</p>
  `;

  const overviewSection = document.createElement('section');
  overviewSection.className = 'section dashboard-grid';
  overviewSection.appendChild(renderOverviewCard('Total accounts', '—'));
  overviewSection.appendChild(renderOverviewCard('Prime accounts', '—'));
  overviewSection.appendChild(renderOverviewCard('Recently checked', '—'));
  overviewSection.appendChild(renderOverviewCard('Inventory value', '—'));

  const quickActions = document.createElement('div');
  quickActions.className = 'card';
  quickActions.innerHTML = `
    <h2>Quick Actions</h2>
    <div class="action-group">
      <button class="button">Add Account</button>
      <button class="button">Import Accounts</button>
      <button class="button secondary" id="view-statistics-button">View Statistics</button>
    </div>
  `;

  container.appendChild(headerCard);
  container.appendChild(overviewSection);
  container.appendChild(quickActions);

  const statisticsButton = quickActions.querySelector('#view-statistics-button');
  if (statisticsButton && typeof navigate === 'function') {
    statisticsButton.addEventListener('click', () => navigate('statistics'));
  }
}
