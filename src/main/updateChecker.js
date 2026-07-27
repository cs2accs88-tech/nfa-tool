const https = require('https');
const { getAppVersion } = require('./versionService');
const logger = require('../logs/logger');

const UPDATE_CHECK_URL = process.env.UPDATE_CHECK_URL || '';
const DEFAULT_TIMEOUT_MS = 10_000;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: DEFAULT_TIMEOUT_MS }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (error) {
          reject(new Error('Invalid update server response')); 
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Update check timed out'));
    });
  });
}

async function checkForUpdates() {
  if (!UPDATE_CHECK_URL) {
    return {
      success: false,
      enabled: false,
      error: 'Update check URL is not configured.'
    };
  }

  try {
    const latest = await fetchJson(UPDATE_CHECK_URL);
    const currentVersion = getAppVersion();
    const latestVersion = latest.version || latest.tag_name || null;
    const releaseNotes = latest.releaseNotes || latest.notes || null;

    const updateAvailable = latestVersion && latestVersion !== currentVersion;
    return {
      success: true,
      enabled: true,
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseNotes,
      updateUrl: latest.url || latest.downloadUrl || UPDATE_CHECK_URL
    };
  } catch (error) {
    logger.error('updateChecker.checkForUpdates', { action: 'updateCheck', message: error.message });
    return {
      success: false,
      enabled: true,
      error: error.message
    };
  }
}

module.exports = {
  checkForUpdates
};