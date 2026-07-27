const { getDatabase } = require('../database/connection');

const db = getDatabase();

function createLog(action, component, message, payload = null) {
  try {
    db.prepare(`
      INSERT INTO activity_logs (action, component, message, payload, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(action, component, message, payload ? JSON.stringify(payload) : null, new Date().toISOString());
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getLogs({ limit = 100, offset = 0 } = {}) {
  try {
    const rows = db.prepare(`SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(limit, offset);
    return { success: true, logs: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createLog,
  getLogs
};
