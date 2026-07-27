const { getDatabase } = require('../database/connection');

const db = getDatabase();

function saveSetting(key, value) {
  const updatedAt = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO settings (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `).run(key, value, updatedAt);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getSetting(key) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return { success: true, value: row ? row.value : null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  saveSetting,
  getSetting
};
