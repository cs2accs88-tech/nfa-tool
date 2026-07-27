export function createTopbar(title, onSearch, onFilterClick, onReportClick) {
  const topbar = document.createElement('div');
  topbar.className = 'topbar';

  const titleBlock = document.createElement('div');
  titleBlock.innerHTML = `<h1 class="topbar-title">${title}</h1>`;

  const actions = document.createElement('div');
  actions.className = 'topbar-actions';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search SteamID, username or notes...';
  searchInput.className = 'search-input';
  searchInput.addEventListener('input', (event) => onSearch(event.target.value));

  const filterButton = document.createElement('button');
  filterButton.type = 'button';
  filterButton.className = 'button secondary';
  filterButton.innerHTML = 'Filters';
  filterButton.addEventListener('click', onFilterClick);

  const reportButton = document.createElement('button');
  reportButton.type = 'button';
  reportButton.className = 'button secondary';
  reportButton.textContent = 'Report';
  reportButton.addEventListener('click', onReportClick);

  actions.appendChild(searchInput);
  actions.appendChild(filterButton);
  actions.appendChild(reportButton);

  topbar.appendChild(titleBlock);
  topbar.appendChild(actions);
  return topbar;
}
