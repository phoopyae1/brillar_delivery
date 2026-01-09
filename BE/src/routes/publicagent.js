const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { validateBody } = require('../middleware/validate');
const { trackingCodeSchema, registerSchema, priceCalculatorSchema } = require('../validators');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });

// POST /public/agent/register - Public API to register a new user (no auth required)
router.post('/public/agent/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  
  // Prevent ADMIN role registration
  if (role === 'ADMIN') {
    throw new AppError(403, 'Admin role cannot be created through registration');
  }
  
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(400, 'Email already registered');
  }
  
  // Hash password
  const hashed = await bcrypt.hash(password, 10);
  
  // Create user
  const user = await prisma.user.create({ 
    data: { 
      name, 
      email, 
      password: hashed, 
      role, 
      phone: phone || null 
    } 
  });
  
  // Generate JWT token
  const token = signToken(user);
  
  // Return response in format expected by public agent
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
    //   token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone
      }
    }
  });
});

// POST /public/agent/deliveries/trackingCode - Public API to get delivery details by tracking code (no auth required)
router.post('/public/agent/deliveries/trackingCode', validateBody(trackingCodeSchema), async (req, res) => {
  const trackingCode = req.body.trackingCode;
  
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      trackingCode: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      destinationAddress: true,
      receiverName: true,
      receiverPhone: true,
      pdfUrl: true,
      createdAt: true,
      sender: { select: { id: true, name: true, email: true, phone: true, role: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          note: true,
          proofImageUrl: true,
          locationText: true,
          createdAt: true,
          createdBy: { select: { name: true, phone: true, role: true } }
        }
      }
    }
  });
  
  if (!delivery) {
    throw new AppError(404, 'Delivery not found');
  }
  
  // Return response in format expected by public agent
  res.json({
    success: true,
    data: delivery
  });
});

// Pricing structure (base prices in USD)
const PRICING = {
  // Base price per route
  'SG-TH': { base: 25, perKg: 8, express: 35, standard: 25 },
  'TH-SG': { base: 25, perKg: 8, express: 35, standard: 25 },
  'TH-MM': { base: 20, perKg: 6, express: 30, standard: 20 },
  'MM-TH': { base: 20, perKg: 6, express: 30, standard: 20 },
  'SG-MM': { base: 30, perKg: 10, express: 45, standard: 30 },
  'MM-SG': { base: 30, perKg: 10, express: 45, standard: 30 }
};

// Estimated delivery times (in days)
const DELIVERY_TIMES = {
  'SG-TH': { express: 2, standard: 5 },
  'TH-SG': { express: 2, standard: 5 },
  'TH-MM': { express: 3, standard: 7 },
  'MM-TH': { express: 3, standard: 7 },
  'SG-MM': { express: 4, standard: 8 },
  'MM-SG': { express: 4, standard: 8 }
};

// POST /public/agent/price-calculator - Public API to calculate shipping price (no auth required)
router.post('/public/agent/price-calculator', validateBody(priceCalculatorSchema), async (req, res) => {
  const { origin, destination, weight, serviceType } = req.body;
  
  // Validate that origin and destination are different
  if (origin === destination) {
    throw new AppError(400, 'Origin and destination cannot be the same');
  }
  
  // Build route key (e.g., 'SG-TH', 'TH-MM')
  const routeKey = `${origin}-${destination}`;
  
  // Validate that the route is supported
  if (!PRICING[routeKey] || !DELIVERY_TIMES[routeKey]) {
    const supportedRoutes = Object.keys(PRICING).join(', ');
    throw new AppError(400, `Route from ${origin} to ${destination} is not supported. Supported routes: ${supportedRoutes}`);
  }
  
  // Get pricing and delivery times for the route
  const routePricing = PRICING[routeKey];
  const routeDelivery = DELIVERY_TIMES[routeKey];
  
  // Calculate price
  const weightNum = typeof weight === 'string' ? parseFloat(weight) : weight;
  const basePrice = serviceType === 'express' ? routePricing.express : routePricing.standard;
  const totalPrice = basePrice + (routePricing.perKg * Math.max(0, weightNum - 1)); // First kg included
  
  // Get delivery days
  const deliveryDays = serviceType === 'express' ? routeDelivery.express : routeDelivery.standard;
  
  // Return response
  res.json({
    success: true,
    data: {
      origin,
      destination,
      weight: weightNum,
      serviceType,
      price: parseFloat(totalPrice.toFixed(2)),
      currency: 'USD',
      deliveryDays,
      breakdown: {
        basePrice: serviceType === 'express' ? routePricing.express : routePricing.standard,
        perKgPrice: routePricing.perKg,
        additionalWeight: Math.max(0, weightNum - 1),
        additionalWeightCost: parseFloat((routePricing.perKg * Math.max(0, weightNum - 1)).toFixed(2))
      }
    }
  });
});

module.exports = router;

