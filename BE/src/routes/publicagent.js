const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { validateBody } = require('../middleware/validate');
const { trackingCodeSchema, registerSchema, priceCalculatorSchema, createDeliverySchema } = require('../validators');
const { AppError } = require('../middleware/errorHandler');
const { generateTrackingCode } = require('../utils/trackingCode');
const { generateDeliveryPDF } = require('../utils/pdfGenerator');

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

// POST /public/agent/deliveries/timeline - Public API to get delivery timeline with formatted dates (no auth required)
router.post('/public/agent/deliveries/timeline', validateBody(trackingCodeSchema), async (req, res) => {
  try {
    const trackingCode = req.body.trackingCode;
    
    const delivery = await prisma.delivery.findUnique({
      where: { trackingCode },
      select: {
        id: true,
        trackingCode: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
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
    
    // Format timeline events with date and time
    const timeline = delivery.events.map((event, index) => {
      const eventDate = new Date(event.createdAt);
      return {
        id: event.id,
        type: event.type,
        status: event.type, // Alias for consistency
        note: event.note || null,
        locationText: event.locationText || null,
        proofImageUrl: event.proofImageUrl || null,
        date: eventDate.toISOString().split('T')[0], // YYYY-MM-DD format
        time: eventDate.toTimeString().split(' ')[0], // HH:MM:SS format
        dateTime: eventDate.toISOString(), // Full ISO format
        formattedDate: eventDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }), // e.g., "January 12, 2024"
        formattedTime: eventDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }), // e.g., "02:30 PM"
        formattedDateTime: eventDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }), // e.g., "January 12, 2024, 02:30 PM"
        timestamp: eventDate.getTime(), // Unix timestamp
        isLatest: index === delivery.events.length - 1, // Mark the latest event
        createdBy: event.createdBy ? {
          name: event.createdBy.name,
          phone: event.createdBy.phone,
          role: event.createdBy.role
        } : null
      };
    });
    
    // Return formatted timeline response
    res.json({
      success: true,
      data: {
        trackingCode: delivery.trackingCode,
        title: delivery.title,
        status: delivery.status,
        priority: delivery.priority,
        createdAt: delivery.createdAt,
        formattedCreatedAt: new Date(delivery.createdAt).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        totalEvents: delivery.events.length,
        timeline: timeline,
        progress: {
          currentStep: delivery.events.length > 0 ? delivery.events.length - 1 : 0,
          totalSteps: delivery.events.length,
          percentage: delivery.events.length > 0 ? Math.round(((delivery.events.length) / 7) * 100) : 0 // Assuming max 7 steps
        }
      }
    });
  } catch (error) {
    console.error('[Public Agent API] Error fetching timeline:', error);
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delivery timeline',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Pricing structure (base prices in USD)
// Supported countries: SG (Singapore), TH (Thailand), MM (Myanmar), MY (Malaysia), ID (Indonesia), PH (Philippines), VN (Vietnam), KH (Cambodia), LA (Laos)
const PRICING = {
  // Singapore routes
  'SG-TH': { base: 25, perKg: 8, express: 35, standard: 25 },
  'SG-MM': { base: 30, perKg: 10, express: 45, standard: 30 },
  'SG-MY': { base: 15, perKg: 5, express: 22, standard: 15 },
  'SG-ID': { base: 28, perKg: 9, express: 40, standard: 28 },
  'SG-PH': { base: 32, perKg: 11, express: 48, standard: 32 },
  'SG-VN': { base: 26, perKg: 8, express: 38, standard: 26 },
  'SG-KH': { base: 24, perKg: 7, express: 35, standard: 24 },
  'SG-LA': { base: 27, perKg: 9, express: 40, standard: 27 },
  
  // Thailand routes
  'TH-SG': { base: 25, perKg: 8, express: 35, standard: 25 },
  'TH-MM': { base: 20, perKg: 6, express: 30, standard: 20 },
  'TH-MY': { base: 22, perKg: 7, express: 32, standard: 22 },
  'TH-ID': { base: 30, perKg: 10, express: 45, standard: 30 },
  'TH-PH': { base: 35, perKg: 12, express: 52, standard: 35 },
  'TH-VN': { base: 18, perKg: 5, express: 26, standard: 18 },
  'TH-KH': { base: 15, perKg: 4, express: 22, standard: 15 },
  'TH-LA': { base: 16, perKg: 5, express: 24, standard: 16 },
  
  // Myanmar routes
  'MM-SG': { base: 30, perKg: 10, express: 45, standard: 30 },
  'MM-TH': { base: 20, perKg: 6, express: 30, standard: 20 },
  'MM-MY': { base: 25, perKg: 8, express: 38, standard: 25 },
  'MM-ID': { base: 32, perKg: 11, express: 48, standard: 32 },
  'MM-PH': { base: 38, perKg: 13, express: 57, standard: 38 },
  'MM-VN': { base: 22, perKg: 7, express: 33, standard: 22 },
  'MM-KH': { base: 20, perKg: 6, express: 30, standard: 20 },
  'MM-LA': { base: 18, perKg: 5, express: 27, standard: 18 },
  
  // Malaysia routes
  'MY-SG': { base: 15, perKg: 5, express: 22, standard: 15 },
  'MY-TH': { base: 22, perKg: 7, express: 32, standard: 22 },
  'MY-MM': { base: 25, perKg: 8, express: 38, standard: 25 },
  'MY-ID': { base: 20, perKg: 6, express: 30, standard: 20 },
  'MY-PH': { base: 28, perKg: 9, express: 42, standard: 28 },
  'MY-VN': { base: 24, perKg: 8, express: 36, standard: 24 },
  'MY-KH': { base: 22, perKg: 7, express: 33, standard: 22 },
  'MY-LA': { base: 23, perKg: 7, express: 35, standard: 23 },
  
  // Indonesia routes
  'ID-SG': { base: 28, perKg: 9, express: 40, standard: 28 },
  'ID-TH': { base: 30, perKg: 10, express: 45, standard: 30 },
  'ID-MM': { base: 32, perKg: 11, express: 48, standard: 32 },
  'ID-MY': { base: 20, perKg: 6, express: 30, standard: 20 },
  'ID-PH': { base: 25, perKg: 8, express: 38, standard: 25 },
  'ID-VN': { base: 28, perKg: 9, express: 42, standard: 28 },
  'ID-KH': { base: 26, perKg: 8, express: 39, standard: 26 },
  'ID-LA': { base: 27, perKg: 9, express: 41, standard: 27 },
  
  // Philippines routes
  'PH-SG': { base: 32, perKg: 11, express: 48, standard: 32 },
  'PH-TH': { base: 35, perKg: 12, express: 52, standard: 35 },
  'PH-MM': { base: 38, perKg: 13, express: 57, standard: 38 },
  'PH-MY': { base: 28, perKg: 9, express: 42, standard: 28 },
  'PH-ID': { base: 25, perKg: 8, express: 38, standard: 25 },
  'PH-VN': { base: 30, perKg: 10, express: 45, standard: 30 },
  'PH-KH': { base: 32, perKg: 11, express: 48, standard: 32 },
  'PH-LA': { base: 33, perKg: 11, express: 50, standard: 33 },
  
  // Vietnam routes
  'VN-SG': { base: 26, perKg: 8, express: 38, standard: 26 },
  'VN-TH': { base: 18, perKg: 5, express: 26, standard: 18 },
  'VN-MM': { base: 22, perKg: 7, express: 33, standard: 22 },
  'VN-MY': { base: 24, perKg: 8, express: 36, standard: 24 },
  'VN-ID': { base: 28, perKg: 9, express: 42, standard: 28 },
  'VN-PH': { base: 30, perKg: 10, express: 45, standard: 30 },
  'VN-KH': { base: 12, perKg: 3, express: 18, standard: 12 },
  'VN-LA': { base: 14, perKg: 4, express: 21, standard: 14 },
  
  // Cambodia routes
  'KH-SG': { base: 24, perKg: 7, express: 35, standard: 24 },
  'KH-TH': { base: 15, perKg: 4, express: 22, standard: 15 },
  'KH-MM': { base: 20, perKg: 6, express: 30, standard: 20 },
  'KH-MY': { base: 22, perKg: 7, express: 33, standard: 22 },
  'KH-ID': { base: 26, perKg: 8, express: 39, standard: 26 },
  'KH-PH': { base: 32, perKg: 11, express: 48, standard: 32 },
  'KH-VN': { base: 12, perKg: 3, express: 18, standard: 12 },
  'KH-LA': { base: 13, perKg: 4, express: 20, standard: 13 },
  
  // Laos routes
  'LA-SG': { base: 27, perKg: 9, express: 40, standard: 27 },
  'LA-TH': { base: 16, perKg: 5, express: 24, standard: 16 },
  'LA-MM': { base: 18, perKg: 5, express: 27, standard: 18 },
  'LA-MY': { base: 23, perKg: 7, express: 35, standard: 23 },
  'LA-ID': { base: 27, perKg: 9, express: 41, standard: 27 },
  'LA-PH': { base: 33, perKg: 11, express: 50, standard: 33 },
  'LA-VN': { base: 14, perKg: 4, express: 21, standard: 14 },
  'LA-KH': { base: 13, perKg: 4, express: 20, standard: 13 }
};

// Estimated delivery times (in days)
const DELIVERY_TIMES = {
  // Singapore routes
  'SG-TH': { express: 2, standard: 5 },
  'SG-MM': { express: 4, standard: 8 },
  'SG-MY': { express: 1, standard: 3 },
  'SG-ID': { express: 3, standard: 6 },
  'SG-PH': { express: 4, standard: 8 },
  'SG-VN': { express: 3, standard: 6 },
  'SG-KH': { express: 3, standard: 6 },
  'SG-LA': { express: 3, standard: 7 },
  
  // Thailand routes
  'TH-SG': { express: 2, standard: 5 },
  'TH-MM': { express: 3, standard: 7 },
  'TH-MY': { express: 3, standard: 6 },
  'TH-ID': { express: 4, standard: 8 },
  'TH-PH': { express: 5, standard: 10 },
  'TH-VN': { express: 2, standard: 5 },
  'TH-KH': { express: 2, standard: 4 },
  'TH-LA': { express: 2, standard: 5 },
  
  // Myanmar routes
  'MM-SG': { express: 4, standard: 8 },
  'MM-TH': { express: 3, standard: 7 },
  'MM-MY': { express: 4, standard: 8 },
  'MM-ID': { express: 5, standard: 9 },
  'MM-PH': { express: 6, standard: 11 },
  'MM-VN': { express: 4, standard: 7 },
  'MM-KH': { express: 3, standard: 7 },
  'MM-LA': { express: 3, standard: 6 },
  
  // Malaysia routes
  'MY-SG': { express: 1, standard: 3 },
  'MY-TH': { express: 3, standard: 6 },
  'MY-MM': { express: 4, standard: 8 },
  'MY-ID': { express: 3, standard: 6 },
  'MY-PH': { express: 4, standard: 8 },
  'MY-VN': { express: 3, standard: 7 },
  'MY-KH': { express: 3, standard: 6 },
  'MY-LA': { express: 3, standard: 7 },
  
  // Indonesia routes
  'ID-SG': { express: 3, standard: 6 },
  'ID-TH': { express: 4, standard: 8 },
  'ID-MM': { express: 5, standard: 9 },
  'ID-MY': { express: 3, standard: 6 },
  'ID-PH': { express: 3, standard: 7 },
  'ID-VN': { express: 4, standard: 8 },
  'ID-KH': { express: 4, standard: 8 },
  'ID-LA': { express: 4, standard: 8 },
  
  // Philippines routes
  'PH-SG': { express: 4, standard: 8 },
  'PH-TH': { express: 5, standard: 10 },
  'PH-MM': { express: 6, standard: 11 },
  'PH-MY': { express: 4, standard: 8 },
  'PH-ID': { express: 3, standard: 7 },
  'PH-VN': { express: 4, standard: 9 },
  'PH-KH': { express: 5, standard: 9 },
  'PH-LA': { express: 5, standard: 10 },
  
  // Vietnam routes
  'VN-SG': { express: 3, standard: 6 },
  'VN-TH': { express: 2, standard: 5 },
  'VN-MM': { express: 4, standard: 7 },
  'VN-MY': { express: 3, standard: 7 },
  'VN-ID': { express: 4, standard: 8 },
  'VN-PH': { express: 4, standard: 9 },
  'VN-KH': { express: 2, standard: 4 },
  'VN-LA': { express: 2, standard: 5 },
  
  // Cambodia routes
  'KH-SG': { express: 3, standard: 6 },
  'KH-TH': { express: 2, standard: 4 },
  'KH-MM': { express: 3, standard: 7 },
  'KH-MY': { express: 3, standard: 6 },
  'KH-ID': { express: 4, standard: 8 },
  'KH-PH': { express: 5, standard: 9 },
  'KH-VN': { express: 2, standard: 4 },
  'KH-LA': { express: 2, standard: 4 },
  
  // Laos routes
  'LA-SG': { express: 3, standard: 7 },
  'LA-TH': { express: 2, standard: 5 },
  'LA-MM': { express: 3, standard: 6 },
  'LA-MY': { express: 3, standard: 7 },
  'LA-ID': { express: 4, standard: 8 },
  'LA-PH': { express: 5, standard: 10 },
  'LA-VN': { express: 2, standard: 5 },
  'LA-KH': { express: 2, standard: 4 }
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

// Helper function to create delivery event
const createEvent = ({ deliveryId, type, note, locationText, proofImageUrl, userId }) =>
  prisma.deliveryEvent.create({
    data: { deliveryId, type, note, locationText, proofImageUrl, createdById: userId }
  });

// POST /public/agent/deliveries - Public API to create delivery shipment (no auth required)
router.post('/public/agent/deliveries', validateBody(createDeliverySchema), async (req, res) => {
  try {
    const trackingCode = generateTrackingCode();
    
    console.log('[Public Agent API] Creating delivery shipment');
    console.log('[Public Agent API] Request body:', req.body);
    
    // Find or create sender user based on email
    let sender;
    if (req.body.senderEmail) {
      sender = await prisma.user.findUnique({
        where: { email: req.body.senderEmail },
        select: { id: true, name: true, email: true, phone: true, role: true }
      });
      
      // If user doesn't exist, create a guest sender user
      if (!sender) {
        // Generate a random password for guest user (they can reset it later)
        const randomPassword = Math.random().toString(36).slice(-12);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        sender = await prisma.user.create({
          data: {
            name: req.body.senderName || 'Guest User',
            email: req.body.senderEmail,
            password: hashedPassword,
            role: 'SENDER',
            phone: req.body.senderPhone || null
          },
          select: { id: true, name: true, email: true, phone: true, role: true }
        });
        
        console.log('[Public Agent API] Created guest sender user:', sender.id);
      } else {
        // Update sender info if provided
        if (req.body.senderName || req.body.senderPhone) {
          sender = await prisma.user.update({
            where: { id: sender.id },
            data: {
              ...(req.body.senderName && { name: req.body.senderName }),
              ...(req.body.senderPhone && { phone: req.body.senderPhone })
            },
            select: { id: true, name: true, email: true, phone: true, role: true }
          });
        }
        console.log('[Public Agent API] Using existing sender user:', sender.id);
      }
    } else {
      throw new AppError(400, 'Sender email is required');
    }
    
    // Build title and description from form data if not provided
    let title = req.body.title;
    let description = req.body.description;
    
    if (!title) {
      if (req.body.shipmentType === 'documents') {
        title = `${req.body.documentType || 'Document'} - ${req.body.quantity || 1} item(s)`;
      } else {
        title = `Package - ${req.body.packageSize || 'Standard'} - ${req.body.quantity || 1} item(s)`;
      }
    }
    
    if (!description) {
      const descriptionParts = [];
      
      // Shipment type details
      if (req.body.shipmentType === 'documents') {
        descriptionParts.push(`Type: Document`);
        if (req.body.documentType) descriptionParts.push(`Document Type: ${req.body.documentType}`);
      } else {
        descriptionParts.push(`Type: Package`);
        if (req.body.packageSize) descriptionParts.push(`Package Size: ${req.body.packageSize}`);
      }
      
      if (req.body.quantity) descriptionParts.push(`Quantity: ${req.body.quantity}`);
      if (req.body.weight) descriptionParts.push(`Weight: ${req.body.weight}kg`);
      if (req.body.originCountry) descriptionParts.push(`Origin: ${req.body.originCountry}`);
      if (req.body.destinationCountry) descriptionParts.push(`Destination: ${req.body.destinationCountry}`);
      if (req.body.serviceType) descriptionParts.push(`Service: ${req.body.serviceType}`);
      if (req.body.paymentMethod) descriptionParts.push(`Payment: ${req.body.paymentMethod}`);
      if (req.body.preferredDate) descriptionParts.push(`Preferred Date: ${req.body.preferredDate}`);
      if (req.body.preferredTime) descriptionParts.push(`Preferred Time: ${req.body.preferredTime}`);
      if (req.body.calculatedPrice) descriptionParts.push(`Price: $${req.body.calculatedPrice.toFixed(2)} USD`);
      if (req.body.deliveryDays) descriptionParts.push(`Estimated Delivery: ${req.body.deliveryDays} day(s)`);
      
      // Sender info
      if (req.body.senderAddress) {
        descriptionParts.push(`Sender Address: ${req.body.senderAddress}`);
        if (req.body.senderPostalCode) descriptionParts.push(`Sender Postal: ${req.body.senderPostalCode}`);
      }
      
      // Receiver info
      if (req.body.recipientPostalCode) {
        descriptionParts.push(`Receiver Postal: ${req.body.recipientPostalCode}`);
      }
      
      description = descriptionParts.join(' | ') || 'Delivery shipment';
    }
    
    // Build full destination address
    let destinationAddress = req.body.destinationAddress;
    if (req.body.recipientPostalCode) {
      destinationAddress = `${req.body.destinationAddress}, ${req.body.recipientPostalCode}`;
    }
    if (req.body.destinationCountry) {
      destinationAddress = `${destinationAddress}, ${req.body.destinationCountry}`;
    }
    
    // Create delivery in database
    const delivery = await prisma.delivery.create({
      data: {
        title,
        description,
        priority: req.body.priority || 'MEDIUM',
        receiverName: req.body.receiverName,
        receiverPhone: req.body.receiverPhone,
        destinationAddress: destinationAddress,
        senderId: sender.id,
        trackingCode,
        status: 'CREATED'
      }
    });
    
    console.log('[Public Agent API] Delivery saved to database:', {
      id: delivery.id,
      trackingCode: delivery.trackingCode,
      status: delivery.status,
      title: delivery.title,
      senderId: delivery.senderId
    });
    
    // Generate PDF with QR code (non-blocking - continue even if it fails)
    try {
      console.log('[Public Agent API] Generating PDF for delivery:', delivery.trackingCode);
      const pdfFileName = await generateDeliveryPDF(delivery, sender);
      console.log('[Public Agent API] PDF generated, updating delivery with filename:', pdfFileName);
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { pdfUrl: pdfFileName }
      });
    } catch (pdfError) {
      console.error('[Public Agent API] Error generating PDF (non-critical):', pdfError.message);
      // Continue even if PDF generation fails - delivery is already saved
    }
    
    // Create delivery event
    try {
      await createEvent({ 
        deliveryId: delivery.id, 
        type: 'CREATED', 
        note: 'Delivery created by public agent', 
        userId: sender.id 
      });
      console.log('[Public Agent API] Delivery event created');
    } catch (eventError) {
      console.error('[Public Agent API] Error creating event (non-critical):', eventError.message);
      // Continue even if event creation fails - delivery is already saved
    }
    
    // Get full delivery details with relations
    const deliveryWithDetails = await prisma.delivery.findUnique({
      where: { id: delivery.id },
      include: {
        sender: { select: { id: true, name: true, email: true, phone: true, role: true } },
        assignments: { 
          include: { 
            courier: { select: { id: true, name: true, email: true, role: true } } 
          }, 
          orderBy: { assignedAt: 'desc' } 
        },
        events: { 
          include: { 
            createdBy: { select: { id: true, name: true, phone: true, role: true } } 
          }, 
          orderBy: { createdAt: 'asc' } 
        }
      }
    });
    
    console.log('[Public Agent API] Delivery creation completed successfully');
    
    // Return response in format expected by public agent
    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      data: deliveryWithDetails
    });
  } catch (error) {
    console.error('[Public Agent API] Error creating delivery:', error);
    console.error('[Public Agent API] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Return error response
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create delivery',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

module.exports = router;

