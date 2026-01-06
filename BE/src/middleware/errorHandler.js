class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const errorHandler = (err, req, res, next) => {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ message: 'Validation failed', issues: err.flatten() });
  }
  
  // Handle MongoDB CastError (invalid ID format)
  if (err?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  
  // Handle MongoDB duplicate key error
  if (err?.code === 11000) {
    return res.status(400).json({ message: 'Integration with this contextual key already exists' });
  }
  
  // Handle MongoDB validation errors
  if (err?.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') || 'Validation failed' });
  }
  
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error('Error:', err);
  res.status(status).json({ message });
};

module.exports = { AppError, errorHandler };
