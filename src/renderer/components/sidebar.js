export function createSidebar(onNavigate, activePage) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = `
    <div class="brand-icon">SM</div>
    <div>
      <h1 class="brand-title">Steam Manager</h1>
      <p class="brand-subtitle">Desktop dashboard</p>
    </div>
  `;

  const navLinks = document.createElement('nav');
  navLinks.className = 'nav-links';

  const pages = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'backup', label: 'Backup' },
    { id: 'import', label: 'Import' },
    { id: 'statistics', label: 'Statistics' },
    { id: 'settings', label: 'Settings' }
  ];

  pages.forEach((page) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-link';
    button.dataset.page = page.id;
    button.textContent = page.label;
    if (page.id === activePage) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => onNavigate(page.id));
    navLinks.appendChild(button);
  });

  sidebar.appendChild(brand);
  sidebar.appendChild(navLinks);
  return sidebar;
}
