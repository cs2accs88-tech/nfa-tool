export function renderSettingsPage(container) {
  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = `
    <h2>Settings</h2>
    <p>Configure Steam Manager, manage import preferences, and adjust application options in a future release.</p>
  `;

  const settingsCard = document.createElement('div');
  settingsCard.className = 'card';
  settingsCard.innerHTML = `
    <h2>App Preferences</h2>
    <div class="filter-panel">
      <label>
        Default duplicate behavior
        <select>
          <option value="skip">Skip duplicates</option>
          <option value="update">Update existing</option>
          <option value="replace">Replace existing</option>
        </select>
      </label>
      <label>
        Import file type
        <select>
          <option value="auto">Auto detect</option>
          <option value="json">JSON only</option>
          <option value="csv">CSV only</option>
          <option value="txt">TXT only</option>
        </select>
      </label>
    </div>
  `;

  container.appendChild(header);
  container.appendChild(settingsCard);
}
