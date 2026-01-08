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

// POST /agent/deliveries - Create delivery via sender agent API (requires SENDER role)
router.post('/agent/deliveries', requireAuth, requireRoles('SENDER'), validateBody(createDeliverySchema), async (req, res) => {
  const senderId = req.user.id;
  const trackingCode = generateTrackingCode();
  
  // Get sender details for PDF
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  
  const delivery = await prisma.delivery.create({
    data: {
      ...req.body,
      senderId,
      trackingCode,
      status: 'CREATED'
    }
  });
  
  // Generate PDF with QR code
  try {
    console.log('[Sender Agent API] Generating PDF for delivery:', delivery.trackingCode);
    const pdfFileName = await generateDeliveryPDF(delivery, sender);
    console.log('[Sender Agent API] PDF generated, updating delivery with filename:', pdfFileName);
    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: { pdfUrl: pdfFileName }
    });
    delivery.pdfUrl = updated.pdfUrl;
  } catch (error) {
    console.error('[Sender Agent API] Error generating PDF:', error);
    console.error('[Sender Agent API] Error stack:', error.stack);
    // Continue even if PDF generation fails - delivery is still created
  }
  
  await createEvent({ deliveryId: delivery.id, type: 'CREATED', note: 'Delivery created via sender agent', userId: senderId });
  
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
    console.error('[Sender Agent] Failed to create transaction:', err);
  });
  
  // Get full delivery details with relations
  const deliveryWithDetails = await prisma.delivery.findUnique({
    where: { id: delivery.id },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
      assignments: { 
        include: { 
          courier: { select: { id: true, name: true, email: true, role: true } } 
        }, 
        orderBy: { assignedAt: 'desc' } 
      },
      events: { 
        include: { 
          createdBy: { select: { id: true, name: true, role: true } } 
        }, 
        orderBy: { createdAt: 'asc' } 
      }
    }
  });
  
  // Return response in format expected by sender agent
  res.status(201).json({
    success: true,
    message: 'Delivery created successfully',
    data: deliveryWithDetails
  });
});

// POST /agent/deliveries/trackingCode - Get delivery details by tracking code (requires SENDER role)
router.post('/agent/deliveries/trackingCode', requireAuth, requireRoles('SENDER'), validateBody(trackingCodeSchema), async (req, res) => {
  const trackingCode = req.body.trackingCode;
  const senderId = req.user.id;
  
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
      assignments: { 
        include: { 
          courier: { select: { id: true, name: true, email: true, role: true } } 
        }, 
        orderBy: { assignedAt: 'desc' } 
      },
      events: { 
        include: { 
          createdBy: { select: { id: true, name: true, role: true } } 
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
      sender: { select: { id: true, name: true, email: true, role: true } },
      assignments: { 
        include: { 
          courier: { select: { id: true, name: true, email: true, role: true } } 
        }, 
        orderBy: { assignedAt: 'desc' } 
      },
      events: { 
        include: { 
          createdBy: { select: { id: true, name: true, role: true } } 
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

