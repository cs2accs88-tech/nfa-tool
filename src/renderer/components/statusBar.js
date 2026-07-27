export function createStatusBar() {
  const statusBar = document.createElement('div');
  statusBar.className = 'status-bar';
  statusBar.innerHTML = `
    <div class="status-left">
      <span id="status-message">Ready</span>
    </div>
    <div class="status-right">
      <span id="status-details">Last saved: never</span>
    </div>
  `;
  return statusBar;
}

export function updateStatusBar({ message, details }) {
  const messageEl = document.getElementById('status-message');
  const detailsEl = document.getElementById('status-details');
  if (messageEl) {
    messageEl.textContent = message;
  }
  if (detailsEl) {
    detailsEl.textContent = details;
  }
}
