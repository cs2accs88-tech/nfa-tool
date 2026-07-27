import { createTopbar } from '../components/topbar.js';
import { importFile } from '../scripts/api.js';

export function renderImportPage(container) {
  const topbar = createTopbar('Import', () => {}, () => {}, () => {});
  container.appendChild(topbar);

  const importCard = document.createElement('div');
  importCard.className = 'card';
  importCard.innerHTML = `
    <h2>Import Accounts</h2>
    <div class="import-dropzone" id="import-dropzone">
      <p>Drag and drop a JSON, CSV, or TXT file here, or select a file to import.</p>
      <button class="button" id="select-file-button">Choose file</button>
    </div>
    <div class="import-progress" id="import-progress" hidden>
      <div class="import-progress-bar" id="import-progress-bar"></div>
    </div>
    <div id="import-status"></div>
  `;

  container.appendChild(importCard);

  const dropzone = importCard.querySelector('#import-dropzone');
  const selectFileButton = importCard.querySelector('#select-file-button');
  const progressBar = importCard.querySelector('#import-progress-bar');
  const progressWrapper = importCard.querySelector('#import-progress');
  const status = importCard.querySelector('#import-status');

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file) {
      await startImport(file.path);
    }
  });

  selectFileButton.addEventListener('click', async () => {
    status.textContent = 'File selection is not yet available in this demo.';
  });

  async function startImport(filePath) {
    progressWrapper.hidden = false;
    progressBar.style.width = '33%';
    status.textContent = 'Starting import...';

    const result = await importFile(filePath, { duplicateStrategy: 'skip' });

    progressBar.style.width = '100%';
    if (result.success) {
      status.innerHTML = `
        <p><strong>Imported:</strong> ${result.report.imported}</p>
        <p><strong>Updated:</strong> ${result.report.updated}</p>
        <p><strong>Failed:</strong> ${result.report.failed}</p>
        <p><strong>Duplicates:</strong> ${result.report.duplicates}</p>
      `;
    } else {
      status.innerHTML = `<p class="notification error">Import failed: ${result.error}</p>`;
    }
  }
}
