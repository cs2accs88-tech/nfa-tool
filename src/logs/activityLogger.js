const logger = require('./logger');

function logActivity(action, detail = {}) {
  logger.info('activityLogger', {
    action,
    message: detail.message || 'Activity recorded',
    details: detail
  });
}

module.exports = {
  logActivity
};
