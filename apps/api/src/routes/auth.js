const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { registerSchema, loginSchema } = require('../validators');
const { validateBody } = require('../middleware/validate');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(400, 'Email already registered');
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hashed, role } });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(400, 'Invalid credentials');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(400, 'Invalid credentials');
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

module.exports = router;
