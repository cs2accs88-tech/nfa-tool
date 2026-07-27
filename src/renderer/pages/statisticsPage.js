import { createTopbar } from '../components/topbar.js';
import { getDashboardStats, exportStatisticsJson, exportStatisticsCsv, clearStatisticsCache } from '../scripts/api.js';

function createStatisticCard({ title, value, icon, color, detail }) {
  const card = document.createElement('div');
  card.className = 'stat-card';
  card.innerHTML = `
    <div class="label">${title}</div>
    <div class="value" style="color: ${color};">${icon ? `${icon} ` : ''}${value}</div>
    ${detail ? `<div class="label">${detail}</div>` : ''}
  `;
  return card;
}

function createBarChart(title, data) {
  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `<h3 class="chart-title">${title}</h3>`;

  const chartArea = document.createElement('div');
  chartArea.className = 'bar-chart';

  const highestValue = Math.max(...data.map((item) => item.value), 1);

  data.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'bar-chart-item';

    const label = document.createElement('label');
    label.textContent = `${item.label} (${item.value})`;

    const barContainer = document.createElement('div');
    barContainer.className = 'bar';
    barContainer.style.width = `${(item.value / highestValue) * 100}%`;

    row.appendChild(label);
    row.appendChild(barContainer);
    chartArea.appendChild(row);
  });

  card.appendChild(chartArea);
  return card;
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function createRecentActivitySection(activities) {
  const section = document.createElement('div');
  section.className = 'card';
  section.innerHTML = `
    <h2>Recent Activity</h2>
    <table class="activity-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Account</th>
          <th>Details</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = section.querySelector('tbody');
  activities.forEach((activity) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${activity.action}</td>
      <td>${activity.accountName || activity.accountId || 'Unknown'}</td>
      <td>${activity.details || '—'}</td>
      <td>${activity.date || '—'}</td>
    `;
    tbody.appendChild(row);
  });

  return section;
}

function createFilterSection(filters, onChange) {
  const section = document.createElement('div');
  section.className = 'card';
  section.innerHTML = `
    <div class="statistics-header">
      <div>
        <h2>Statistics Filters</h2>
        <p>Restrict the dashboard by date range, tags, status, rank, and inventory value.</p>
      </div>
      <div class="export-actions">
        <button class="button secondary" id="export-json">Export JSON</button>
        <button class="button secondary" id="export-csv">Export CSV</button>
        <button class="button tertiary" id="clear-cache">Refresh Data</button>
      </div>
    </div>
    <div class="statistics-header">
      <div class="filters">
        <label>From <input type="date" name="startDate" value="${filters.startDate || ''}" /></label>
        <label>To <input type="date" name="endDate" value="${filters.endDate || ''}" /></label>
        <label>Tags <input type="text" name="tags" value="${filters.tags || ''}" placeholder="e.g. prime, trade" /></label>
        <label>Prime <select name="primeStatus"><option value="">Any</option><option value="true">Prime</option><option value="false">Standard</option></select></label>
        <label>VAC <select name="vacStatus"><option value="">Any</option><option value="true">Banned</option><option value="false">Clean</option></select></label>
      </div>
    </div>
    <div class="statistics-header">
      <div class="filters">
        <label>Rank Min <input type="number" name="rankMin" value="${filters.rankMin ?? ''}" min="0" /></label>
        <label>Rank Max <input type="number" name="rankMax" value="${filters.rankMax ?? ''}" min="0" /></label>
        <label>Inventory Min <input type="number" name="inventoryMin" value="${filters.inventoryMin ?? ''}" min="0" /></label>
        <label>Inventory Max <input type="number" name="inventoryMax" value="${filters.inventoryMax ?? ''}" min="0" /></label>
      </div>
    </div>
  `;

  const inputs = section.querySelectorAll('input, select');
  inputs.forEach((input) => input.addEventListener('change', onChange));

  return section;
}

function getFilterValues(section) {
  const filters = {};
  const formData = new FormData(section.querySelector('form') || section);

  for (const [key, value] of formData.entries()) {
    if (!value) {
      continue;
    }
    if (key === 'tags') {
      filters[key] = value;
      continue;
    }
    if (['primeStatus', 'vacStatus', 'cooldownStatus'].includes(key)) {
      filters[key] = value;
      continue;
    }
    filters[key] = Number(value);
  }

  return filters;
}

export async function renderStatisticsPage(container) {
  const filters = {};
  const topbar = createTopbar('Statistics', () => {}, () => {}, () => {});
  container.appendChild(topbar);

  const filterSection = createFilterSection(filters, async () => {
    await reloadDashboard();
  });
  container.appendChild(filterSection);

  const overviewSection = document.createElement('section');
  overviewSection.className = 'statistics-grid';
  container.appendChild(overviewSection);

  const chartsSection = document.createElement('section');
  chartsSection.className = 'charts-grid';
  container.appendChild(chartsSection);

  const activitySection = document.createElement('section');
  container.appendChild(activitySection);

  async function reloadDashboard() {
    const filterValues = {
      ...filters,
      startDate: filterSection.querySelector('[name="startDate"]').value,
      endDate: filterSection.querySelector('[name="endDate"]').value,
      tags: filterSection.querySelector('[name="tags"]').value,
      primeStatus: filterSection.querySelector('[name="primeStatus"]').value,
      vacStatus: filterSection.querySelector('[name="vacStatus"]').value,
      rankMin: Number(filterSection.querySelector('[name="rankMin"]').value) || undefined,
      rankMax: Number(filterSection.querySelector('[name="rankMax"]').value) || undefined,
      inventoryMin: Number(filterSection.querySelector('[name="inventoryMin"]').value) || undefined,
      inventoryMax: Number(filterSection.querySelector('[name="inventoryMax"]').value) || undefined
    };

    const result = await getDashboardStats(filterValues);
    if (!result.success) {
      container.appendChild(document.createTextNode(`Failed to load statistics: ${result.error}`));
      return;
    }

    const dashboard = result.data;
    overviewSection.innerHTML = '';
    chartsSection.innerHTML = '';
    activitySection.innerHTML = '';

    overviewSection.appendChild(createStatisticCard({ title: 'Total Accounts', value: dashboard.accountStatistics.totalAccounts, icon: '🧾', color: '#7dd3fc' }));
    overviewSection.appendChild(createStatisticCard({ title: 'Active Accounts', value: dashboard.accountStatistics.activeAccounts, icon: '⚡', color: '#34d399' }));
    overviewSection.appendChild(createStatisticCard({ title: 'Recently Added', value: dashboard.accountStatistics.recentlyAdded, icon: '🆕', color: '#fbbf24' }));
    overviewSection.appendChild(createStatisticCard({ title: 'Recently Updated', value: dashboard.accountStatistics.recentlyUpdated, icon: '🔄', color: '#c084fc' }));
    overviewSection.appendChild(createStatisticCard({ title: 'Missing Info', value: dashboard.accountStatistics.accountsWithMissingInfo, icon: '⚠️', color: '#f87171' }));
    overviewSection.appendChild(createStatisticCard({ title: 'Prime Accounts', value: dashboard.statusStatistics.primeAccounts, icon: '⭐', color: '#38bdf8' }));
    overviewSection.appendChild(createStatisticCard({ title: 'VAC Clean', value: dashboard.statusStatistics.vacCleanAccounts, icon: '✅', color: '#22c55e' }));
    overviewSection.appendChild(createStatisticCard({ title: 'Inventory Value', value: formatCurrency(dashboard.inventoryStatistics.totalInventoryValue), icon: '💰', color: '#f97316' }));

    chartsSection.appendChild(createBarChart('Rank Distribution', dashboard.rankStatistics.rankDistribution));
    chartsSection.appendChild(createBarChart('Inventory Value Distribution', dashboard.inventoryStatistics.inventoryDistribution));

    activitySection.appendChild(createRecentActivitySection(dashboard.recentActivity));

    const exportJsonButton = filterSection.querySelector('#export-json');
    const exportCsvButton = filterSection.querySelector('#export-csv');
    const clearCacheButton = filterSection.querySelector('#clear-cache');

    exportJsonButton.onclick = async () => {
      const exportResult = await exportStatisticsJson(filterValues);
      if (exportResult.success) {
        const blob = new Blob([exportResult.data.json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `steam-manager-statistics-${new Date().toISOString()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`Export failed: ${exportResult.error}`);
      }
    };

    exportCsvButton.onclick = async () => {
      const exportResult = await exportStatisticsCsv(filterValues);
      if (exportResult.success) {
        const blob = new Blob([exportResult.data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `steam-manager-statistics-${new Date().toISOString()}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`Export failed: ${exportResult.error}`);
      }
    };

    clearCacheButton.onclick = async () => {
      await clearStatisticsCache();
      await reloadDashboard();
    };
  }

  await reloadDashboard();
}
