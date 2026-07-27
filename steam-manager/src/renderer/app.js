/**
 * @module renderer/app
 * @description Renderer logic: loading transition, navigation, token import, accounts view.
 */

(function () {
  'use strict';

  const loadingScreen = document.getElementById('loading-screen');
  const appContainer = document.getElementById('app');
  const loadingStatus = document.getElementById('loading-status');

  function setStatus(text) { if (loadingStatus) loadingStatus.textContent = text; }
  function showApp() { loadingScreen.classList.add('hidden'); appContainer.classList.add('visible'); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  let toastTimer = null;
  function toast(message, isError) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.toggle('err', !!isError);
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  /* ---------- Navigation ---------- */
  function switchView(view) {
    document.querySelectorAll('.nav-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.remove('hidden');
    if (view === 'accounts') loadAccounts();
    if (view === 'dashboard') refreshCount();
    if (view === 'status') loadStatus();
    if (view === 'updates') loadUpdates();
  }

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  /**
   * Returns to the default empty state (no view selected).
   */
  function showEmpty() {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    const empty = document.getElementById('view-empty');
    if (empty) empty.classList.remove('hidden');
  }

  /* ---------- Global keyboard handling ---------- */
  // Capture phase so TAB is intercepted before the browser moves focus.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      // Only the app handles TAB: open the Dashboard, never move focus.
      e.preventDefault();
      e.stopPropagation();
      switchView('dashboard');
    } else if (e.key === 'Escape') {
      // Close overlays/modals and return to the default state.
      const t = document.getElementById('toast');
      if (t) t.classList.add('hidden');
      const r = document.getElementById('import-result');
      if (r) r.classList.add('hidden');
      showEmpty();
    }
  }, true);

  /* ---------- Token import ---------- */
  function renderResult(summary) {
    const el = document.getElementById('import-result');
    el.classList.remove('hidden');
    const imported = summary.importedCount || 0;
    const updated = summary.updatedCount || 0;
    const failed = summary.failedCount || 0;
    let html = `<div><span class="ok">${imported} imported</span>`;
    if (updated) html += ` &middot; <span class="ok">${updated} updated</span>`;
    if (failed) html += ` &middot; <span class="err">${failed} failed</span>`;
    html += ` &middot; ${summary.recordCount} total lines</div>`;
    if (summary.errors && summary.errors.length) {
      html += '<ul>';
      summary.errors.slice(0, 10).forEach((e) => {
        html += `<li>Line ${e.index}: ${esc((e.errors || []).join(', '))}</li>`;
      });
      html += '</ul>';
    }
    el.innerHTML = html;
  }

  async function importPasted() {
    const text = document.getElementById('token-input').value;
    if (!text.trim()) { toast('Paste some tokens first', true); return; }
    const btn = document.getElementById('btn-import-tokens');
    btn.disabled = true; btn.textContent = 'Importing…';
    try {
      const res = await window.api.tokens.import(text);
      if (res.success) {
        renderResult(res.summary);
        toast('Import complete');
        refreshCount();
      } else {
        toast(res.error || 'Import failed', true);
      }
    } catch (e) {
      toast('Import failed: ' + e.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Import Tokens';
    }
  }

  async function importFromFile() {
    const btn = document.getElementById('btn-import-file');
    btn.disabled = true;
    try {
      const res = await window.api.tokens.importFile();
      if (res.success) {
        renderResult(res.summary);
        toast('Imported from file');
        refreshCount();
      } else if (!res.canceled) {
        toast(res.error || 'Import failed', true);
      }
    } catch (e) {
      toast('Import failed: ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  document.getElementById('btn-import-tokens').addEventListener('click', importPasted);
  document.getElementById('btn-import-file').addEventListener('click', importFromFile);
  document.getElementById('btn-clear').addEventListener('click', () => {
    document.getElementById('token-input').value = '';
    document.getElementById('import-result').classList.add('hidden');
  });

  /* ---------- Accounts ---------- */
  function pill(yes) {
    return yes ? '<span class="pill yes">Yes</span>' : '<span class="pill no">No</span>';
  }

  /**
   * Small token-status pill for the Accounts table. The Accounts tab tracks
   * a binary state (Alive / Dead) — anything that isn't a live login is Dead.
   * Accounts that have never been checked show no pill.
   */
  function tokenStatusBadge(updateStatus) {
    if (!updateStatus || updateStatus === 'idle') return '';
    const alive = updateStatus === 'valid';
    return ' ' + (alive
      ? '<span class="st success">Alive</span>'
      : '<span class="st dead">Dead</span>');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  /* ---------- Account selection + Steam client sign-in ---------- */
  // The user picks an account (row click), then "Start Selected" injects it.
  let selectedAccountId = null;   // currently highlighted account
  let activeClient = null;        // account currently signed into the Steam client
  let injecting = false;          // guards against double-clicks / concurrent runs

  /** Highlights an account and enables the Start button. */
  function selectAccount(id) {
    selectedAccountId = id;
    applySelection();
    updateLoginButton();
  }

  /** Repaints the selected-row highlight to match `selectedAccountId`. */
  function applySelection() {
    const body = document.getElementById('accounts-body');
    if (!body) return;
    body.querySelectorAll('tr.acct-row').forEach((tr) => {
      tr.classList.toggle('selected', Number(tr.dataset.accountId) === selectedAccountId);
    });
  }

  /** Adds the "signed in" badge to the row of the active client account. */
  function applyActiveBadge() {
    const body = document.getElementById('accounts-body');
    if (!body) return;
    const activeId = activeClient && activeClient.accountId != null ? Number(activeClient.accountId) : null;
    body.querySelectorAll('tr.acct-row').forEach((tr) => {
      tr.classList.toggle('active', activeId != null && Number(tr.dataset.accountId) === activeId);
    });
  }

  /** Enables the Start button only when an account is selected and idle. */
  function updateLoginButton() {
    const btn = document.getElementById('btn-login-selected');
    if (btn) btn.disabled = injecting || statusChecking || selectedAccountId == null;
  }

  /** Loads the persisted active-client account and paints its badge. */
  async function restoreActiveClient() {
    try {
      if (!window.api || !window.api.auth) return;
      const res = await window.api.auth.getActiveClient();
      if (res && res.success) { activeClient = res.active; applyActiveBadge(); }
    } catch { /* non-fatal */ }
  }

  /**
   * Injects the selected account into the Steam client. Disables the button for
   * the whole operation so a second click cannot start a duplicate injection.
   */
  async function loginWithSelected() {
    if (selectedAccountId == null) { toast('Select an account first', true); return; }
    if (injecting) return;
    if (statusChecking) { toast('A check is running — please wait'); return; }

    const btn = document.getElementById('btn-login-selected');

    injecting = true;
    updateLoginButton();
    const originalLabel = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = 'Starting…';

    try {
      const res = await window.api.auth.loginClient(selectedAccountId);
      if (res && res.success) {
        toast(`Steam is starting${res.accountName ? ' as ' + res.accountName : ''}`);
        activeClient = { accountId: selectedAccountId, steamId64: res.steamId64, accountName: res.accountName };
        applyActiveBadge();
      } else {
        toast((res && res.error) || 'Steam sign-in failed', true);
      }
    } catch (e) {
      toast('Steam sign-in failed: ' + e.message, true);
    } finally {
      injecting = false;
      if (btn) btn.innerHTML = originalLabel;
      updateLoginButton();
    }
  }

  async function loadAccounts() {
    const body = document.getElementById('accounts-body');
    body.innerHTML = '<tr><td colspan="11" class="empty">Loading…</td></tr>';
    try {
      const res = await window.api.accounts.list({ limit: 500 });
      if (!res.success) { body.innerHTML = `<tr><td colspan="11" class="empty">${esc(res.error)}</td></tr>`; return; }
      if (!res.accounts.length) {
        body.innerHTML = '<tr><td colspan="11" class="empty">No accounts yet. Import tokens to get started.</td></tr>';
        return;
      }
      body.innerHTML = res.accounts.map((a) => {
        const name = esc(a.username) || '—';
        const initial = esc((a.username || '?').trim().slice(0, 1).toUpperCase() || '?');
        const avatar = a.avatarUrl
          ? `<img class="acct-av" src="${esc(a.avatarUrl)}" alt="" data-fallback="${initial}">`
          : `<span class="acct-av ph">${initial}</span>`;
        return `
        <tr class="acct-row${a.hasToken ? '' : ' no-token'}" data-account-id="${a.id}" data-has-token="${a.hasToken ? '1' : '0'}" data-name="${name}">
          <td class="mono">${esc(a.steamId64)}</td>
          <td><span class="acct">${avatar}<span class="acct-name">${name}</span></span></td>
          <td class="mono">${esc(a.tokenMasked) || '—'}${tokenStatusBadge(a.updateStatus)}</td>
          <td>${a.rank == null ? '—' : esc(a.rank)}</td>
          <td>${a.rating == null || a.rating === 0 ? '—' : esc(a.rating)}</td>
          <td>${pill(a.prime)}</td>
          <td>${a.vacBanned ? '<span class="pill no">Banned</span>' : '<span class="pill yes">Clean</span>'}</td>
          <td>${esc(a.inventoryValue)}</td>
          <td>${esc(fmtDate(a.lastChecked))}</td>
          <td>${a.profileUrl ? `<a class="link" data-url="${esc(a.profileUrl)}">Open</a>` : '—'}</td>
          <td class="row-actions">
            ${a.hasToken ? `<a class="link" data-copy="${a.id}">Copy token</a>` : ''}
            <a class="link danger" data-delete="${a.id}" data-name="${name}">Delete</a>
          </td>
        </tr>`;
      }).join('');

      // CSP-safe avatar fallback: swap a failed image for a monogram badge.
      body.querySelectorAll('.acct-av[data-fallback]').forEach((img) => {
        img.addEventListener('error', () => {
          const span = document.createElement('span');
          span.className = 'acct-av ph';
          span.textContent = img.dataset.fallback || '?';
          img.replaceWith(span);
        });
      });

      body.querySelectorAll('[data-url]').forEach((el) => {
        el.addEventListener('click', (e) => { e.stopPropagation(); window.api.invoke('shell:openExternal', el.dataset.url); });
      });
      body.querySelectorAll('[data-copy]').forEach((el) => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const r = await window.api.accounts.copyToken(Number(el.dataset.copy));
          toast(r.success ? 'Token copied to clipboard' : (r.error || 'Copy failed'), !r.success);
        });
      });

      // Delete: two-step inline confirm to avoid accidental removals. The first
      // click arms the link ("Confirm?"); a second click within 3s deletes.
      body.querySelectorAll('[data-delete]').forEach((el) => {
        let armed = false;
        let armTimer = null;
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!armed) {
            armed = true;
            el.textContent = 'Confirm?';
            el.classList.add('armed');
            armTimer = setTimeout(() => {
              armed = false;
              el.textContent = 'Delete';
              el.classList.remove('armed');
            }, 3000);
            return;
          }
          clearTimeout(armTimer);
          const id = Number(el.dataset.delete);
          const r = await window.api.accounts.delete(id);
          if (r && r.success) {
            toast('Account deleted');
            loadAccounts();
            refreshCount();
          } else {
            toast((r && r.error) || 'Delete failed', true);
            el.textContent = 'Delete';
            el.classList.remove('armed');
            armed = false;
          }
        });
      });

      // Row selection: clicking a row (its action links stopPropagation, so
      // they are unaffected) selects the account for the Start button.
      body.querySelectorAll('tr.acct-row').forEach((tr) => {
        tr.addEventListener('click', () => {
          if (tr.dataset.hasToken !== '1') { toast('This account has no token to start', true); return; }
          selectAccount(Number(tr.dataset.accountId));
        });
      });

      // Drop a stale selection if that account is gone, then repaint the cues.
      if (selectedAccountId != null &&
          !body.querySelector(`tr.acct-row[data-account-id="${selectedAccountId}"]`)) {
        selectedAccountId = null;
      }
      applySelection();
      applyActiveBadge();
      updateLoginButton();
    } catch (e) {
      body.innerHTML = `<tr><td colspan="11" class="empty">${esc(e.message)}</td></tr>`;
    }
  }

  /* ---------- Accounts actions ----------
   * The Accounts tab has no Refresh button: "Check All" in the Account Status
   * tab is the single source of truth for account information + status. It
   * automatically reloads the Accounts table on completion (loadAccounts()
   * inside checkAllStatus()) and after per-account updates.
   */
  const btnLoginSelected = document.getElementById('btn-login-selected');
  if (btnLoginSelected) btnLoginSelected.addEventListener('click', loginWithSelected);

  async function refreshCount() {
    try {
      const res = await window.api.accounts.count();
      if (res.success) document.getElementById('stat-accounts').textContent = res.count;
    } catch { /* ignore */ }
  }

  /* ---------- Account Status ---------- */
  let statusData = [];         // last-loaded per-account status objects
  let statusChecking = false;  // guard: no overlapping/duplicate checks
  let removeDeadArmed = false;
  let removeDeadTimer = null;

  /**
   * Runs a full revalidation, streaming progress to `onProgress`. Shared by the
   * Account Status "Check All" button and the Accounts "Refresh" button.
   */
  async function runStatusCheck(onProgress, useLogin) {
    const unsubscribe = window.api.status.onProgress(onProgress || (() => {}));
    try {
      return await (useLogin ? window.api.status.loginCheckAll() : window.api.status.checkAll());
    } finally {
      if (typeof unsubscribe === 'function') unsubscribe();
    }
  }

  function tokenPill(status) {
    switch (status) {
      case 'valid': return '<span class="st success">Valid</span>';
      case 'expired': return '<span class="st failed">Expired</span>';
      case 'dead': return '<span class="st dead">Dead</span>';
      default: return '<span class="st dead">Invalid</span>';
    }
  }

  function vacPill(v) {
    return v === 'banned'
      ? '<span class="pill no">VAC Banned</span>'
      : '<span class="pill yes">Not VAC Banned</span>';
  }

  function setSummary(total, valid, dead) {
    document.getElementById('sum-total').textContent = total;
    document.getElementById('sum-valid').textContent = valid;
    document.getElementById('sum-dead').textContent = dead;
  }

  function summaryFromData() {
    const total = statusData.length;
    const valid = statusData.filter((a) => a.alive).length;
    setSummary(total, valid, total - valid);
  }

  /** Applies the current filter + sort selection to the loaded status data. */
  function filteredSortedStatus() {
    const filter = document.getElementById('status-filter').value;
    const sort = document.getElementById('status-sort').value;
    let list = statusData.slice();
    if (filter === 'valid') list = list.filter((a) => a.alive);
    else if (filter === 'dead') list = list.filter((a) => !a.alive);
    else if (filter === 'vac') list = list.filter((a) => a.vacStatus === 'banned');

    const comparators = {
      name: (a, b) => String(a.accountName).localeCompare(String(b.accountName)),
      status: (a, b) => (a.alive === b.alive ? 0 : (a.alive ? 1 : -1)), // dead first
      rank: (a, b) => (b.rank || 0) - (a.rank || 0),
      checked: (a, b) => new Date(b.lastChecked || 0) - new Date(a.lastChecked || 0)
    };
    const cmp = comparators[sort];
    if (cmp) list.sort(cmp);
    return list;
  }

  function renderStatusTable() {
    const body = document.getElementById('status-body');
    if (!statusData.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No accounts yet. Import tokens to get started.</td></tr>';
      return;
    }
    const list = filteredSortedStatus();
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No accounts match this filter.</td></tr>';
      return;
    }
    body.innerHTML = list.map((a) => {
      const name = esc(a.accountName) || '—';
      const initial = esc((a.accountName || '?').trim().slice(0, 1).toUpperCase() || '?');
      const avatar = a.avatarUrl
        ? `<img class="acct-av" src="${esc(a.avatarUrl)}" alt="" data-fallback="${initial}">`
        : `<span class="acct-av ph">${initial}</span>`;
      return `
      <tr>
        <td class="col-dot"><span class="status-dot ${a.alive ? 'green' : 'red'}" title="${a.alive ? 'Valid' : 'Dead'}"></span></td>
        <td><span class="acct">${avatar}<span class="acct-name">${name}</span></span></td>
        <td class="mono">${esc(a.steamId64)}</td>
        <td>${tokenPill(a.tokenStatus)}</td>
        <td>${vacPill(a.vacStatus)}</td>
        <td>${a.rank == null ? '—' : esc(a.rank)}</td>
        <td>${esc(fmtDate(a.lastChecked))}</td>
      </tr>`;
    }).join('');

    body.querySelectorAll('.acct-av[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const span = document.createElement('span');
        span.className = 'acct-av ph';
        span.textContent = img.dataset.fallback || '?';
        img.replaceWith(span);
      });
    });
  }

  /** Loads current status instantly (local token check + stored VAC/rank). */
  async function loadStatus() {
    const body = document.getElementById('status-body');
    body.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
    try {
      if (!window.api || !window.api.status) throw new Error('Status API unavailable');
      const res = await window.api.status.list();
      if (!res.success) { body.innerHTML = `<tr><td colspan="7" class="empty">${esc(res.error)}</td></tr>`; return; }
      statusData = res.accounts || [];
      renderStatusTable();
      summaryFromData();
    } catch (e) {
      body.innerHTML = `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
    }
  }

  /** Formats a millisecond ETA as a short human string. */
  function fmtEta(ms) {
    if (ms == null) return 'calculating…';
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  }

  /** Renders a rich progress update (current account, counts, ETA). */
  function renderStatusProgress(p) {
    const wrap = document.getElementById('status-progress');
    if (!wrap) return;
    wrap.classList.remove('hidden');
    const total = p.total || 0;
    const done = p.done || 0;
    document.getElementById('status-progress-fill').style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
    document.getElementById('status-progress-label').textContent = p.phase === 'done'
      ? 'Finalizing…'
      : (p.current ? `Signing in as ${p.current}` : 'Signing in…');
    document.getElementById('status-progress-count').textContent = total ? `${done} / ${total}` : '';
    const detail = document.getElementById('status-progress-detail');
    if (detail) {
      const eta = p.phase === 'done' ? '' : ` · ETA ${fmtEta(p.etaMs)}`;
      detail.textContent = `${p.completed || 0} updated · ${p.failed || 0} failed · ${p.dead || 0} dead${eta}`;
    }
  }

  function resetStatusProgress() {
    renderStatusProgress({ phase: 'processing', done: 0, total: statusData.length || 0, completed: 0, failed: 0, dead: 0, etaMs: null });
  }

  function hideStatusProgress() {
    const wrap = document.getElementById('status-progress');
    if (wrap) wrap.classList.add('hidden');
  }

  /** Shows the end-of-scan summary panel. */
  function showStatusSummary(summary) {
    const el = document.getElementById('status-summary');
    if (!el || !summary) return;
    el.classList.remove('hidden');
    el.innerHTML =
      `<div><span class="ok">${summary.scanned} scanned</span>` +
      ` &middot; <span class="ok">${summary.valid} alive</span>` +
      ` &middot; <span class="${summary.dead ? 'warn' : 'ok'}">${summary.dead} dead</span>` +
      (summary.failed ? ` &middot; <span class="err">${summary.failed} update error${summary.failed === 1 ? '' : 's'}</span>` : '') +
      `</div>`;
  }

  /**
   * "Check All": sequential, one-at-a-time LOCAL revalidation with rich
   * progress + a completion summary. Never logs any account in or out — it only
   * decodes tokens locally and reads stored data. Syncs the Accounts tab when
   * done.
   */
  async function checkAllStatus() {
    if (statusChecking) { toast('A check is already running…'); return; }
    if (!window.api || !window.api.status) { toast('Status API unavailable', true); return; }
    statusChecking = true;
    const btn = document.getElementById('btn-status-check');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const summaryEl = document.getElementById('status-summary');
    if (summaryEl) summaryEl.classList.add('hidden');
    resetStatusProgress();
    try {
      // Login-verified scan: signs in to each account (never logs out) and
      // marks any that cannot sign in as dead.
      const res = await runStatusCheck((p) => renderStatusProgress(p), true);
      if (res && res.success) {
        statusData = res.results || [];
        renderStatusTable();
        if (res.summary) setSummary(res.summary.total, res.summary.valid, res.summary.dead);
        else summaryFromData();
        showStatusSummary(res.summary);
        toast(`Scan complete: ${res.summary.scanned} scanned, ${res.summary.valid} alive, ${res.summary.dead} dead`);
      } else {
        toast((res && res.error) || 'Status check failed', true);
      }
    } catch (e) {
      toast('Status check failed: ' + e.message, true);
    } finally {
      hideStatusProgress();
      btn.disabled = false;
      btn.textContent = original;
      statusChecking = false;
      // Accounts tab is the single source of truth for latest account info,
      // so it is refreshed on every completion path — success, error, or
      // partial. Any per-account update the scan managed to persist is now
      // visible to the user without clicking a button.
      try { await loadAccounts(); } catch { /* non-fatal */ }
      try { await refreshCount(); } catch { /* non-fatal */ }
      try { await restoreActiveClient(); } catch { /* non-fatal */ }
    }
  }

  /** "Remove All Dead": two-step confirm, then delete only dead accounts. */
  async function removeDead() {
    const btn = document.getElementById('btn-remove-dead');
    const dead = statusData.filter((a) => !a.alive).length;

    if (dead === 0) { toast('No dead accounts to remove'); return; }

    if (!removeDeadArmed) {
      removeDeadArmed = true;
      btn.classList.add('armed');
      btn.textContent = `Confirm remove ${dead}?`;
      toast(`Found ${dead} dead account${dead === 1 ? '' : 's'} (invalid/expired) — click again to remove`);
      removeDeadTimer = setTimeout(() => {
        removeDeadArmed = false;
        btn.classList.remove('armed');
        btn.textContent = 'Remove All Dead';
      }, 3500);
      return;
    }

    clearTimeout(removeDeadTimer);
    removeDeadArmed = false;
    btn.classList.remove('armed');
    btn.textContent = 'Remove All Dead';
    btn.disabled = true;
    try {
      const res = await window.api.status.removeDead();
      if (res && res.success) {
        toast(`Removed ${res.removed} dead account${res.removed === 1 ? '' : 's'}`);
        await loadStatus();
        loadAccounts();
        refreshCount();
      } else {
        toast((res && res.error) || 'Remove failed', true);
      }
    } catch (e) {
      toast('Remove failed: ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  document.getElementById('btn-status-check').addEventListener('click', checkAllStatus);
  document.getElementById('btn-remove-dead').addEventListener('click', removeDead);
  document.getElementById('status-filter').addEventListener('change', renderStatusTable);
  document.getElementById('status-sort').addEventListener('change', renderStatusTable);

  /* ---------- Updates ---------- */
  const UPDATE_STATUS_TEXT = {
    idle: 'Ready. Click "Check for Updates" to look for a newer version.',
    disabled: 'Automatic updates run in the installed app. You are running a development build.',
    unavailable: 'The updater is not available in this build.',
    checking: 'Checking for updates…',
    available: 'An update is available.',
    'not-available': 'You are running the latest version.',
    downloading: 'Downloading update…',
    downloaded: 'Update downloaded and verified. Restart to install.',
    installing: 'Installing update and restarting…',
    error: 'Something went wrong with the update.'
  };

  /** Shows/hides an element by id. */
  function show(id, visible) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !visible);
  }

  /** Renders the contextual action buttons + status text for a given state. */
  function renderUpdateState(state) {
    if (!state) return;
    const cur = document.getElementById('upd-current');
    const latest = document.getElementById('upd-latest');
    if (cur) cur.textContent = state.currentVersion ? 'v' + state.currentVersion : '—';
    if (latest) {
      latest.textContent = state.version ? 'v' + state.version
        : (state.state === 'not-available' ? 'v' + (state.currentVersion || '') : '—');
    }

    const statusText = document.getElementById('upd-status-text');
    if (statusText) statusText.textContent = state.message && state.state === 'error'
      ? `Error: ${state.message}`
      : (UPDATE_STATUS_TEXT[state.state] || 'Update status unknown.');

    // Error panel
    const errEl = document.getElementById('upd-error');
    if (errEl) {
      if (state.state === 'error' && state.message) {
        errEl.classList.remove('hidden');
        errEl.textContent = state.message;
      } else {
        errEl.classList.add('hidden');
      }
    }

    // Release notes
    if (state.releaseNotes) {
      show('upd-notes-wrap', true);
      const notes = document.getElementById('upd-notes');
      if (notes) notes.textContent = state.releaseNotes;
    }

    // Progress
    if (state.state === 'downloading' && state.progress) {
      show('upd-progress', true);
      const p = state.progress;
      document.getElementById('upd-progress-fill').style.width = (p.percent || 0) + '%';
      document.getElementById('upd-progress-percent').textContent = (p.percent || 0) + '%';
      document.getElementById('upd-progress-detail').textContent =
        `${p.transferredText} / ${p.totalText} · ${p.speedText} · ETA ${p.etaText}`;
    } else if (state.state !== 'downloading') {
      show('upd-progress', false);
    }

    // Contextual buttons
    const checking = state.state === 'checking' || state.state === 'downloading' || state.state === 'installing';
    const checkBtn = document.getElementById('btn-upd-check');
    if (checkBtn) checkBtn.disabled = checking;
    // Download shown when an update is available and not already auto-downloading.
    show('btn-upd-download', state.state === 'available' && !state.autoDownload);
    show('btn-upd-install', state.state === 'downloaded');
  }

  /** Reflects the persisted settings into the toggle checkboxes. */
  function renderUpdateSettings(settings) {
    if (!settings) return;
    const map = {
      'upd-auto-check': 'autoCheck',
      'upd-auto-download': 'autoDownload',
      'upd-notify': 'notifyBeforeInstall'
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!settings[map[id]];
    });
  }

  /** Renders the update history table (newest first). */
  function renderUpdateHistory(history) {
    const body = document.getElementById('upd-history-body');
    if (!body) return;
    if (!history || !history.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No update activity yet.</td></tr>';
      return;
    }
    body.innerHTML = history.map((h) => `
      <tr>
        <td class="mono">${esc(fmtDate(h.at))}</td>
        <td>${esc(h.event)}</td>
        <td>${h.version ? 'v' + esc(h.version) : '—'}</td>
        <td>${esc(h.message || '')}</td>
      </tr>`).join('');
  }

  /** Loads the full Updates view (state + settings + history). */
  async function loadUpdates() {
    if (!window.api || !window.api.update) return;
    try {
      const [stateRes, settingsRes, historyRes] = await Promise.all([
        window.api.update.getState(),
        window.api.update.getSettings(),
        window.api.update.getHistory(50)
      ]);
      if (stateRes && stateRes.success) renderUpdateState(stateRes.state);
      if (settingsRes && settingsRes.success) renderUpdateSettings(settingsRes.settings);
      if (historyRes && historyRes.success) renderUpdateHistory(historyRes.history);
    } catch (e) {
      toast('Could not load update info: ' + e.message, true);
    }
  }

  async function checkForUpdatesClicked() {
    const btn = document.getElementById('btn-upd-check');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    try {
      const res = await window.api.update.check();
      if (res && res.error) toast('Update check failed: ' + res.error, true);
      else if (res && !res.available) toast(res.reason || 'You are on the latest version');
      else if (res && res.available) toast('Update available: v' + res.version);
    } catch (e) {
      toast('Update check failed: ' + e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Check for Updates'; }
      loadUpdates();
    }
  }

  async function downloadUpdateClicked() {
    const btn = document.getElementById('btn-upd-download');
    if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
    try {
      const res = await window.api.update.download();
      if (res && !res.success) toast(res.error || 'Download failed', true);
    } catch (e) {
      toast('Download failed: ' + e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Download Update'; }
    }
  }

  async function installUpdateClicked() {
    try {
      const res = await window.api.update.install();
      if (res && !res.success) toast(res.error || 'Install failed', true);
    } catch (e) {
      toast('Install failed: ' + e.message, true);
    }
  }

  /** Persists a settings toggle change and refreshes the view. */
  async function updateSettingChanged() {
    const patch = {
      autoCheck: document.getElementById('upd-auto-check').checked,
      autoDownload: document.getElementById('upd-auto-download').checked,
      notifyBeforeInstall: document.getElementById('upd-notify').checked
    };
    try {
      const res = await window.api.update.setSettings(patch);
      if (res && res.success) { renderUpdateSettings(res.settings); toast('Update settings saved'); }
      else toast((res && res.error) || 'Could not save settings', true);
    } catch (e) {
      toast('Could not save settings: ' + e.message, true);
    }
  }

  (function wireUpdatesUi() {
    const check = document.getElementById('btn-upd-check');
    const download = document.getElementById('btn-upd-download');
    const install = document.getElementById('btn-upd-install');
    if (check) check.addEventListener('click', checkForUpdatesClicked);
    if (download) download.addEventListener('click', downloadUpdateClicked);
    if (install) install.addEventListener('click', installUpdateClicked);
    ['upd-auto-check', 'upd-auto-download', 'upd-notify'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', updateSettingChanged);
    });

    // Live status stream: repaint whenever the main process reports progress.
    // Also refresh the history when a milestone completes so the table stays
    // current without a manual reload.
    if (window.api && window.api.update && typeof window.api.update.onStatus === 'function') {
      window.api.update.onStatus((status) => {
        renderUpdateState(status);
        if (status && (status.state === 'downloaded' || status.state === 'available' || status.state === 'error')) {
          window.api.update.getHistory(50).then((r) => {
            if (r && r.success) renderUpdateHistory(r.history);
          }).catch(() => {});
        }
      });
    }
  })();

  /* ---------- Window controls ---------- */
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.close());

  /* ---------- Init ---------- */
  async function init() {
    // Reveal the UI immediately and open the Dashboard so the window is never
    // blank, regardless of database/IPC timing or failures. Data is populated
    // afterwards; failures there never keep the app hidden.
    showApp();
    try { switchView('dashboard'); } catch { /* ignore */ }

    try {
      if (window.api && window.api.getVersion) {
        const version = await window.api.getVersion();
        const vb = document.getElementById('version-badge');
        const sv = document.getElementById('stat-version');
        if (vb) vb.textContent = 'v' + version;
        if (sv) sv.textContent = version;
      }
    } catch { /* ignore */ }

    try { await refreshCount(); } catch { /* ignore */ }
    try { await restoreActiveClient(); } catch { /* ignore */ }
  }

  // Run init as soon as the DOM is ready. A safety timer guarantees the app is
  // revealed even if something above throws unexpectedly.
  setTimeout(() => { try { showApp(); } catch { /* ignore */ } }, 2500);
  init();
})();
