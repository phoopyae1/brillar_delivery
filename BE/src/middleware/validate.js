const { AppError } = require('./errorHandler');

const validateBody = (schema) => (req, _res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    err.name = err.name || 'ZodError';
    throw err instanceof Error ? err : new AppError(400, 'Validation failed');
  }
};

module.exports = { validateBody };
