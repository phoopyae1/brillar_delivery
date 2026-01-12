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

