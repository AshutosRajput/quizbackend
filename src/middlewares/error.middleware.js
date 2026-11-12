const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - Error: ${err.message}`, err.stack);

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors ? err.errors[0]?.path : 'field';
    return errorResponse(res, `Duplicate entry for ${field}. Please use a unique value.`, 409);
  }

  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors ? err.errors.map(e => e.message) : [err.message];
    return errorResponse(res, 'Validation error', 400, messages);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return errorResponse(res, message, statusCode);
};

const notFoundHandler = (req, res) => {
  return errorResponse(res, `Endpoint not found: ${req.method} ${req.originalUrl}`, 404);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};

