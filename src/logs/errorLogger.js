const logger = require('./logger');

function logError(action, error) {
  logger.error('errorLogger', { action, ...error });
}

module.exports = {
  logError
};
