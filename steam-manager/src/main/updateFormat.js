/**
 * @module main/updateFormat
 * @description Pure, dependency-free helpers for the auto-update system:
 * semantic-version comparison and human-friendly formatting of download
 * progress (size, speed, ETA).
 *
 * These are separated out so they can be unit-tested without Electron,
 * electron-updater, or a database, and reused by both the main process and
 * (via IPC-provided values) the renderer.
 */

'use strict';

/**
 * Parses a semantic version string into `[major, minor, patch, prerelease]`.
 * Tolerates a leading `v` and a `-prerelease` / `+build` suffix. Missing parts
 * default to 0. Non-numeric core parts are treated as 0.
 * @param {string} version
 * @returns {{ core:number[], prerelease:string }}
 */
function parseVersion(version) {
  const raw = String(version || '').trim().replace(/^v/i, '');
  const [main, prerelease = ''] = raw.split(/[-+]/, 2);
  const core = main.split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
  while (core.length < 3) core.push(0);
  return { core: core.slice(0, 3), prerelease };
}

/**
 * Compares two semantic versions.
 * A version WITHOUT a prerelease outranks the same core WITH one (1.0.0 > 1.0.0-beta).
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 if a<b, 0 if equal, 1 if a>b
 */
function compareSemver(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (va.core[i] !== vb.core[i]) return va.core[i] < vb.core[i] ? -1 : 1;
  }
  // Equal core: no prerelease > has prerelease; otherwise lexical.
  if (va.prerelease === vb.prerelease) return 0;
  if (!va.prerelease) return 1;
  if (!vb.prerelease) return -1;
  return va.prerelease < vb.prerelease ? -1 : 1;
}

/**
 * @param {string} latest
 * @param {string} current
 * @returns {boolean} whether `latest` is strictly newer than `current`
 */
function isNewerVersion(latest, current) {
  return compareSemver(latest, current) > 0;
}

/**
 * Formats a byte count as a short human string (e.g. `12.3 MB`).
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
function formatBytes(bytes, decimals = 1) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/**
 * Formats a transfer speed (bytes/sec) as e.g. `1.5 MB/s`.
 * @param {number} bytesPerSecond
 * @returns {string}
 */
function formatSpeed(bytesPerSecond) {
  const n = Number(bytesPerSecond);
  if (!Number.isFinite(n) || n <= 0) return '0 B/s';
  return `${formatBytes(n)}/s`;
}

/**
 * Estimates remaining download time in milliseconds.
 * @param {number} totalBytes
 * @param {number} transferredBytes
 * @param {number} bytesPerSecond
 * @returns {number|null} ms remaining, or null when not computable
 */
function etaMs(totalBytes, transferredBytes, bytesPerSecond) {
  const total = Number(totalBytes);
  const done = Number(transferredBytes);
  const speed = Number(bytesPerSecond);
  if (!Number.isFinite(total) || !Number.isFinite(done) || !Number.isFinite(speed) || speed <= 0) return null;
  const remaining = Math.max(0, total - done);
  return Math.round((remaining / speed) * 1000);
}

/**
 * Formats a millisecond duration as a short human string (e.g. `1m 05s`).
 * @param {number|null} ms
 * @returns {string}
 */
function formatEta(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return 'calculating…';
  const s = Math.ceil(Number(ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Normalizes an electron-updater `download-progress` payload into the shape the
 * renderer consumes (adds ETA + preformatted strings).
 * @param {{ percent:number, transferred:number, total:number, bytesPerSecond:number }} p
 * @returns {object}
 */
function normalizeProgress(p) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(p && p.percent) || 0)));
  const transferred = Number(p && p.transferred) || 0;
  const total = Number(p && p.total) || 0;
  const bytesPerSecond = Number(p && p.bytesPerSecond) || 0;
  const eta = etaMs(total, transferred, bytesPerSecond);
  return {
    percent,
    transferred,
    total,
    bytesPerSecond,
    etaMs: eta,
    transferredText: formatBytes(transferred),
    totalText: formatBytes(total),
    speedText: formatSpeed(bytesPerSecond),
    etaText: formatEta(eta)
  };
}

module.exports = {
  parseVersion,
  compareSemver,
  isNewerVersion,
  formatBytes,
  formatSpeed,
  formatEta,
  etaMs,
  normalizeProgress
};
