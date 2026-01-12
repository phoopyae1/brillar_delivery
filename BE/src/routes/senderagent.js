const express = require('express');
const prisma = require('../prisma');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createDeliverySchema, trackingCodeSchema, senderIdSchema } = require('../validators');
const { generateTrackingCode } = require('../utils/trackingCode');
const { generateDeliveryPDF } = require('../utils/pdfGenerator');
const { createTransaction } = require('../utils/transaction');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const requireAuth = [authMiddleware];

// Helper function to create delivery event
const createEvent = ({ deliveryId, type, note, locationText, proofImageUrl, userId }) =>
  prisma.deliveryEvent.create({
    data: { deliveryId, type, note, locationText, proofImageUrl, createdById: userId }
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

// Helper function to calculate delivery price
const calculateDeliveryPrice = ({ originCountry, destinationCountry, weight, quantity = 1, serviceType = 'standard' }) => {
  // Validate that origin and destination are provided
  if (!originCountry || !destinationCountry) {
    return null;
  }

  // Validate that origin and destination are different
  if (originCountry === destinationCountry) {
    return null;
  }

  // Build route key (e.g., 'SG-TH', 'TH-MM')
  const routeKey = `${originCountry}-${destinationCountry}`;

  // Validate that the route is supported
  if (!PRICING[routeKey] || !DELIVERY_TIMES[routeKey]) {
    return null;
  }

  // Get pricing for the route
  const routePricing = PRICING[routeKey];

  // Calculate price per item
  const weightNum = typeof weight === 'string' ? parseFloat(weight) : (weight || 1);
  const basePrice = serviceType === 'express' ? routePricing.express : routePricing.standard;
  const pricePerItem = basePrice + (routePricing.perKg * Math.max(0, weightNum - 1)); // First kg included

  // Multiply by quantity
  const totalPrice = pricePerItem * (quantity || 1);

  // Get delivery days
  const routeDelivery = DELIVERY_TIMES[routeKey];
  const deliveryDays = serviceType === 'express' ? routeDelivery.express : routeDelivery.standard;

  return {
    price: parseFloat(totalPrice.toFixed(2)),
    deliveryDays,
    currency: 'USD'
  };
};

// POST /agent/deliveries - Create delivery via sender agent API (requires SENDER role)
router.post('/agent/deliveries', requireAuth, requireRoles('SENDER'), validateBody(createDeliverySchema), async (req, res) => {
  try {
    // Use senderId from request body if provided, otherwise use authenticated user's ID
    // Note: senderId is a UUID string, not an integer
    const senderId = req.body.senderId || req.user.id;
    
    const trackingCode = generateTrackingCode();
    
    console.log('[Sender Agent API] Creating delivery for sender:', senderId);
    console.log('[Sender Agent API] Request body:', req.body);
    console.log('[Sender Agent API] Using senderId:', senderId);
    
    // Get sender details for PDF (include phone)
    const sender = await prisma.user.findUnique({ 
      where: { id: senderId },
      select: { id: true, name: true, email: true, phone: true, role: true }
    });
    
    if (!sender) {
      console.error('[Sender Agent API] Sender not found:', senderId);
      return res.status(404).json({
        success: false,
        error: `Sender not found with ID: ${senderId}`
      });
    }
    
    // Verify sender has SENDER role (if senderId was provided in body)
    if (req.body.senderId && sender.role !== 'SENDER') {
      console.error('[Sender Agent API] User is not a sender:', sender.role);
      return res.status(400).json({
        success: false,
        error: `User with ID ${senderId} is not a SENDER (role: ${sender.role})`
      });
    }
    
    // Auto-calculate price if not provided
    let calculatedPrice = req.body.calculatedPrice;
    let deliveryDays = req.body.deliveryDays;
    
    if (!calculatedPrice && req.body.originCountry && req.body.destinationCountry) {
      const priceCalculation = calculateDeliveryPrice({
        originCountry: req.body.originCountry,
        destinationCountry: req.body.destinationCountry,
        weight: req.body.weight || 1,
        quantity: req.body.quantity || 1,
        serviceType: req.body.serviceType || 'standard'
      });
      
      if (priceCalculation) {
        calculatedPrice = priceCalculation.price;
        if (!deliveryDays) {
          deliveryDays = priceCalculation.deliveryDays;
        }
        console.log('[Sender Agent API] Auto-calculated price:', calculatedPrice, 'USD, Delivery days:', deliveryDays);
      } else {
        console.warn('[Sender Agent API] Could not calculate price - route may not be supported or missing required fields');
      }
    }
    
    // Build title from form data if not provided
    let title = req.body.title;
    if (!title) {
      if (req.body.shipmentType === 'documents') {
        title = `${req.body.documentType || 'Document'} - ${req.body.quantity || 1} item(s)`;
      } else if (req.body.shipmentType === 'packages') {
        title = `Package - ${req.body.packageSize || 'Standard'} - ${req.body.quantity || 1} item(s)`;
      } else {
        title = `Delivery - ${req.body.quantity || 1} item(s)`;
      }
    }
    
    // Build description from form data if not provided
    let description = req.body.description;
    if (!description) {
      const descriptionParts = [];
      
      // Shipment type details
      if (req.body.shipmentType === 'documents') {
        descriptionParts.push(`Type: Document`);
        if (req.body.documentType) descriptionParts.push(`Document Type: ${req.body.documentType}`);
      } else if (req.body.shipmentType === 'packages') {
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
      if (calculatedPrice !== undefined && calculatedPrice !== null) {
        const price = typeof calculatedPrice === 'number' 
          ? calculatedPrice 
          : parseFloat(calculatedPrice);
        if (!isNaN(price)) {
          descriptionParts.push(`Price: $${price.toFixed(2)} USD`);
        }
      }
      if (deliveryDays !== undefined && deliveryDays !== null) {
        const days = typeof deliveryDays === 'number' 
          ? deliveryDays 
          : parseInt(deliveryDays);
        if (!isNaN(days)) {
          descriptionParts.push(`Estimated Delivery: ${days} day(s)`);
        }
      }
      
      // Sender info
      if (req.body.senderAddress) {
        descriptionParts.push(`Sender Address: ${req.body.senderAddress}`);
        if (req.body.senderPostalCode) descriptionParts.push(`Sender Postal: ${req.body.senderPostalCode}`);
      }
      if (req.body.senderName) descriptionParts.push(`Sender: ${req.body.senderName}`);
      if (req.body.senderPhone) descriptionParts.push(`Sender Phone: ${req.body.senderPhone}`);
      
      // Receiver info
      if (req.body.recipientPostalCode) {
        descriptionParts.push(`Receiver Postal: ${req.body.recipientPostalCode}`);
      }
      
      description = descriptionParts.join(' | ') || 'Delivery shipment';
    }
    
    // Build full destination address from components if needed
    let destinationAddress = req.body.destinationAddress;
    if (!destinationAddress || destinationAddress.trim() === '') {
      // Build from components if destinationAddress is not provided
      const addressParts = [];
      if (req.body.recipientAddress) addressParts.push(req.body.recipientAddress);
      if (req.body.recipientPostalCode) addressParts.push(req.body.recipientPostalCode);
      if (req.body.destinationCountry) addressParts.push(req.body.destinationCountry);
      destinationAddress = addressParts.join(', ') || req.body.destinationAddress;
    } else {
      // Append postal code and country if not already included
      if (req.body.recipientPostalCode && !destinationAddress.includes(req.body.recipientPostalCode)) {
        destinationAddress = `${destinationAddress}, ${req.body.recipientPostalCode}`;
      }
      if (req.body.destinationCountry && !destinationAddress.includes(req.body.destinationCountry)) {
        destinationAddress = `${destinationAddress}, ${req.body.destinationCountry}`;
      }
    }
    
    // Ensure required fields are present
    const receiverName = req.body.receiverName || req.body.recipientName;
    const receiverPhone = req.body.receiverPhone || req.body.recipientPhone;
    
    if (!receiverName || !receiverPhone || !destinationAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: receiverName, receiverPhone, and destinationAddress are required'
      });
    }
    
    // Create delivery in database with only allowed fields
    const delivery = await prisma.delivery.create({
      data: {
        title,
        description,
        priority: req.body.priority || 'MEDIUM',
        receiverName: receiverName,
        receiverPhone: receiverPhone,
        destinationAddress: destinationAddress,
        senderId,
        trackingCode,
        status: 'CREATED'
      }
    });
    
    console.log('[Sender Agent API] Delivery saved to database:', {
      id: delivery.id,
      trackingCode: delivery.trackingCode,
      status: delivery.status,
      title: delivery.title,
      senderId: delivery.senderId
    });
    
    // Generate PDF with QR code (non-blocking - continue even if it fails)
    try {
      console.log('[Sender Agent API] Generating PDF for delivery:', delivery.trackingCode);
      const pdfFileName = await generateDeliveryPDF(delivery, sender);
      console.log('[Sender Agent API] PDF generated, updating delivery with filename:', pdfFileName);
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { pdfUrl: pdfFileName }
      });
    } catch (pdfError) {
      console.error('[Sender Agent API] Error generating PDF (non-critical):', pdfError.message);
      // Continue even if PDF generation fails - delivery is already saved
    }
    
    // Create delivery event
    try {
      await createEvent({ 
        deliveryId: delivery.id, 
        type: 'CREATED', 
        note: 'Delivery created via sender agent', 
        userId: senderId 
      });
      console.log('[Sender Agent API] Delivery event created');
    } catch (eventError) {
      console.error('[Sender Agent API] Error creating event (non-critical):', eventError.message);
      // Continue even if event creation fails - delivery is already saved
    }
    
    // Create transaction via Atenxion API (non-blocking)
    createTransaction(senderId, {
      type: 'DELIVERY_CREATED',
      deliveryId: delivery.id,
      trackingCode: delivery.trackingCode,
      title: delivery.title,
      status: delivery.status,
      priority: delivery.priority,
      createdAt: delivery.createdAt
    }, 'SENDER').catch(err => {
      console.error('[Sender Agent] Failed to create transaction (non-critical):', err.message);
    });
    
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
    
    console.log('[Sender Agent API] Delivery creation completed successfully');
    
    // Return response in format expected by sender agent
    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      data: {
        ...deliveryWithDetails,
        calculatedPrice: calculatedPrice !== undefined && calculatedPrice !== null ? calculatedPrice : null,
        deliveryDays: deliveryDays !== undefined && deliveryDays !== null ? deliveryDays : null,
        currency: calculatedPrice !== undefined && calculatedPrice !== null ? 'USD' : null
      }
    });
  } catch (error) {
    console.error('[Sender Agent API] Error creating delivery:', error);
    console.error('[Sender Agent API] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Return error response
    res.status(500).json({
      success: false,
      error: 'Failed to create delivery',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// POST /agent/deliveries/trackingCode - Get delivery details by tracking code (requires SENDER role)
router.post('/agent/deliveries/trackingCode', requireAuth, requireRoles('SENDER'), validateBody(trackingCodeSchema), async (req, res) => {
  const trackingCode = req.body.trackingCode;
  const senderId = req.user.id;
  
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode },
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
  
  if (!delivery) {
    throw new AppError(404, 'Delivery not found');
  }
  
  // Ensure the sender can only access their own deliveries
  if (delivery.senderId !== senderId) {
    throw new AppError(403, 'You do not have permission to access this delivery');
  }
  
  // Return response in format expected by sender agent
  res.json({
    success: true,
    data: delivery
  });
});

// POST /agent/deliveries/list - Get all deliveries for sender with full details (requires SENDER role)
router.post('/agent/deliveries/list', requireAuth, requireRoles('SENDER'), validateBody(senderIdSchema), async (req, res) => {
  // Use senderId from request body or authenticated user's ID
  const requestedSenderId = req.body.senderId || req.user.id;
  const authenticatedSenderId = req.user.id;
  
  // Ensure sender can only access their own deliveries
  if (requestedSenderId !== authenticatedSenderId) {
    throw new AppError(403, 'You can only view your own deliveries');
  }
  
  // Get all deliveries for this sender with full details
  const deliveries = await prisma.delivery.findMany({
    where: { senderId: requestedSenderId },
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
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Format response with route information for each delivery
  const formattedDeliveries = deliveries.map(delivery => ({
    id: delivery.id,
    trackingCode: delivery.trackingCode,
    title: delivery.title,
    description: delivery.description,
    priority: delivery.priority,
    status: delivery.status,
    destinationAddress: delivery.destinationAddress,
    receiverName: delivery.receiverName,
    receiverPhone: delivery.receiverPhone,
    pdfUrl: delivery.pdfUrl,
    createdAt: delivery.createdAt,
    sender: delivery.sender,
    assignedCourier: delivery.assignments.length > 0 ? {
      id: delivery.assignments[0].courier.id,
      name: delivery.assignments[0].courier.name,
      email: delivery.assignments[0].courier.email,
      assignedAt: delivery.assignments[0].assignedAt
    } : null,
    currentRoute: {
      status: delivery.status,
      lastEvent: delivery.events.length > 0 ? {
        type: delivery.events[delivery.events.length - 1].type,
        note: delivery.events[delivery.events.length - 1].note,
        locationText: delivery.events[delivery.events.length - 1].locationText,
        proofImageUrl: delivery.events[delivery.events.length - 1].proofImageUrl,
        createdAt: delivery.events[delivery.events.length - 1].createdAt,
        createdBy: delivery.events[delivery.events.length - 1].createdBy
      } : null,
      totalEvents: delivery.events.length,
      routeTimeline: delivery.events.map(event => ({
        id: event.id,
        type: event.type,
        note: event.note,
        locationText: event.locationText,
        proofImageUrl: event.proofImageUrl,
        createdAt: event.createdAt,
        createdBy: event.createdBy
      }))
    }
  }));
  
  // Return response in format expected by sender agent
  res.json({
    success: true,
    total: formattedDeliveries.length,
    data: formattedDeliveries
  });
});

// POST /agent/sender-profile - Get sender profile details with delivery statistics (requires SENDER role)
router.post('/agent/sender-profile', requireAuth, requireRoles('SENDER'), async (req, res) => {
  const senderId = req.user.id;
  
  // Get sender user information
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true
    }
  });
  
  if (!sender) {
    throw new AppError(404, 'Sender not found');
  }
  
  // Calculate date for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get all deliveries for this sender
  const allDeliveries = await prisma.delivery.findMany({
    where: { senderId: senderId },
    select: {
      id: true,
      status: true,
      priority: true,
      createdAt: true
    }
  });
  
  // Calculate statistics
  const totalDeliveries = allDeliveries.length;
  
  // Count by status
  const deliveriesByStatus = {
    CREATED: 0,
    ASSIGNED: 0,
    PICKED_UP: 0,
    IN_TRANSIT: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    FAILED_DELIVERY: 0,
    RETURNED: 0
  };
  
  // Count by priority
  const deliveriesByPriority = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0
  };
  
  // Count recent deliveries (last 30 days)
  let recentDeliveriesLast30Days = 0;
  let recentDeliveredLast30Days = 0;
  
  allDeliveries.forEach(delivery => {
    // Count by status
    if (deliveriesByStatus.hasOwnProperty(delivery.status)) {
      deliveriesByStatus[delivery.status]++;
    }
    
    // Count by priority
    if (deliveriesByPriority.hasOwnProperty(delivery.priority)) {
      deliveriesByPriority[delivery.priority]++;
    }
    
    // Count recent deliveries
    if (new Date(delivery.createdAt) >= thirtyDaysAgo) {
      recentDeliveriesLast30Days++;
      if (delivery.status === 'DELIVERED') {
        recentDeliveredLast30Days++;
      }
    }
  });
  
  // Format dates
  const createdAtDate = new Date(sender.createdAt);
  const userCreatedAt = createdAtDate.toISOString().split('T')[0];
  const userCreatedTime = createdAtDate.toTimeString().split(' ')[0];
  
  // Return response in format expected by sender agent
  res.json({
    status: 'Success',
    userId: sender.id,
    userEmail: sender.email,
    userName: sender.name,
    userRole: sender.role,
    userStatus: 'active',
    userCreatedAt: userCreatedAt,
    userCreatedTime: userCreatedTime,
    userUpdatedAt: userCreatedAt, // Using createdAt as updatedAt since we don't have updatedAt field
    totalDeliveries: totalDeliveries,
    deliveriesByStatus: deliveriesByStatus,
    deliveriesByPriority: deliveriesByPriority,
    recentDeliveriesLast30Days: recentDeliveriesLast30Days,
    recentDeliveredLast30Days: recentDeliveredLast30Days,
    createdDeliveries: deliveriesByStatus.CREATED,
    assignedDeliveries: deliveriesByStatus.ASSIGNED,
    inTransitDeliveries: deliveriesByStatus.IN_TRANSIT,
    outForDeliveryDeliveries: deliveriesByStatus.OUT_FOR_DELIVERY,
    deliveredDeliveries: deliveriesByStatus.DELIVERED,
    cancelledDeliveries: deliveriesByStatus.CANCELLED,
    failedDeliveries: deliveriesByStatus.FAILED_DELIVERY,
    returnedDeliveries: deliveriesByStatus.RETURNED
  });
});

module.exports = router;

