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

