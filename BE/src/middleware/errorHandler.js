class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const errorHandler = (err, req, res, _next) => {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ message: 'Validation failed', issues: err.flatten() });
  }
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(err);
  res.status(status).json({ message });
};

module.exports = { AppError, errorHandler };
