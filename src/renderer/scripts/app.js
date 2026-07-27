import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { createStatusBar, updateStatusBar } from '../components/statusBar.js';
import { renderDashboardPage } from '../pages/dashboardPage.js';
import { renderAccountsPage } from '../pages/accountsPage.js';
import { renderImportPage } from '../pages/importPage.js';
import { renderStatisticsPage } from '../pages/statisticsPage.js';
import { renderSettingsPage } from '../pages/settingsPage.js';
import { renderBackupPage } from '../pages/backupPage.js';
import { renderHealthPage } from '../pages/healthPage.js';

const PAGES = {
  dashboard: renderDashboardPage,
  accounts: renderAccountsPage,
  backup: renderBackupPage,
  import: renderImportPage,
  statistics: renderStatisticsPage,
  settings: renderSettingsPage
};

let activePage = 'dashboard';
let pageContainer;
let sidebarElement;

function createLayout() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  sidebarElement = createSidebar(handleNavigation, activePage);
  pageContainer = document.createElement('div');
  pageContainer.className = 'content';
  const statusBar = createStatusBar();

  shell.appendChild(sidebarElement);
  shell.appendChild(pageContainer);
  app.appendChild(shell);
  app.appendChild(statusBar);
}

function handleNavigation(page) {
  activePage = page;
  const links = sidebarElement.querySelectorAll('.nav-link');
  links.forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  renderCurrentPage();
}

function renderCurrentPage() {
  pageContainer.innerHTML = '';
  const renderPage = PAGES[activePage] || renderDashboardPage;
  renderPage(pageContainer, { navigate: handleNavigation });
}

export function initializeApp() {
  createLayout();
  renderCurrentPage();
}
