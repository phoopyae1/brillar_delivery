const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { registerSchema, loginSchema } = require('../validators');
const { validateBody } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { logoutUser, getIntegrationCredentials } = require('../utils/transaction');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  
  // Prevent ADMIN role registration
  if (role === 'ADMIN') {
    throw new AppError(403, 'Admin role cannot be created through registration');
  }
  
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(400, 'Email already registered');
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hashed, role, phone: phone || null } });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, phone: user.phone } });
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(400, 'Invalid credentials');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(400, 'Invalid credentials');
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, phone: user.phone } });
});

// POST /auth/logout - Logout user and call Atenxion API (requires authentication)
router.post('/logout', authMiddleware, async (req, res) => {
  const user = req.user;
  
  // Only logout SENDER, DISPATCHER, or COURIER roles
  if (!['SENDER', 'DISPATCHER', 'COURIER'].includes(user.role)) {
    return res.json({ 
      success: true, 
      message: 'Logout successful (no external logout required for this role)' 
    });
  }
  
  // Get integration credentials for the user's role
  const credentials = await getIntegrationCredentials(user.role);
  
  if (credentials) {
    const { agentId, token } = credentials;
    
    // Call Atenxion logout API (non-blocking)
    logoutUser(user.id, agentId, token).catch(err => {
      console.error('[Auth] Failed to logout from Atenxion:', err);
    });
  } else {
    console.log(`[Auth] No integration found for role ${user.role}, skipping Atenxion logout`);
  }
  
  // Return success response (logout is successful even if Atenxion call fails)
  res.json({ 
    success: true, 
    message: 'Logout successful' 
  });
});

module.exports = router;
