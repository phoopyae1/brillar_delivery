const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

const authMiddleware = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new AppError(401, 'Missing authorization header');
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    throw new AppError(401, 'Invalid or expired token');
  }
};

const requireRoles = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new AppError(403, 'Forbidden');
  }
  next();
};

module.exports = { authMiddleware, requireRoles };
