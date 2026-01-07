const express = require('express');
const prisma = require('../prisma');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createDeliverySchema, trackingCodeSchema } = require('../validators');
const { generateTrackingCode } = require('../utils/trackingCode');
const { generateDeliveryPDF } = require('../utils/pdfGenerator');
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
  
  // Return response in format expected by sender agent
  res.status(201).json({
    success: true,
    message: 'Delivery created successfully',
    data: delivery
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

