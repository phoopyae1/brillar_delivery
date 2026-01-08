const express = require('express');
const prisma = require('../prisma');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { z } = require('zod');
const { AppError } = require('../middleware/errorHandler');
const { canTransition, getAllowedTransitions } = require('../constants/statuses');

const router = express.Router();
const requireAuth = [authMiddleware];

// Helper function to create delivery event
const createEvent = ({ deliveryId, type, note, locationText, proofImageUrl, userId }) =>
  prisma.deliveryEvent.create({
    data: { deliveryId, type, note, locationText, proofImageUrl, createdById: userId }
  });

// Schema for courier update status/checkpoint request
const courierUpdateSchema = z.object({
  deliveryId: z.string().uuid('Invalid delivery ID format'),
  action: z.enum(['updateStatus', 'addCheckpoint']).default('updateStatus'),
  status: z.enum(['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED']).optional(),
  note: z.string().optional(),
  locationText: z.string().optional(),
  proofImageUrl: z.string().optional() // Base64 encoded image for delivery proof
});

// Helper function to check delivery access for courier
const assertCourierDeliveryAccess = async (courierId, deliveryId) => {
  if (!deliveryId || typeof deliveryId !== 'string') {
    throw new AppError(400, 'Invalid delivery ID');
  }
  
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { assignments: true }
  });
  
  if (!delivery) {
    throw new AppError(404, 'Delivery not found');
  }
  
  // Check if courier is assigned to this delivery
  const assigned = delivery.assignments.some((a) => a.courierId === courierId);
  if (!assigned) {
    throw new AppError(403, 'Delivery is not assigned to you. Only assigned deliveries can be updated.');
  }
  
  return delivery;
};

// POST /agent/courier/update-delivery - Update delivery status or add checkpoint (requires COURIER role)
router.post('/agent/courier/update-delivery', requireAuth, requireRoles('COURIER'), validateBody(courierUpdateSchema), async (req, res) => {
  const deliveryId = req.body.deliveryId;
  const action = req.body.action || 'updateStatus';
  const status = req.body.status;
  const note = req.body.note;
  const locationText = req.body.locationText;
  const proofImageUrl = req.body.proofImageUrl;
  const courierId = req.user.id;
  
  // Check delivery access
  const delivery = await assertCourierDeliveryAccess(courierId, deliveryId);
  
  let updatedDelivery = delivery;
  let event;
  
  if (action === 'updateStatus' && status) {
    // Update status - validate transition
    if (!canTransition(delivery.status, status, 'COURIER')) {
      const allowed = getAllowedTransitions(delivery.status, 'COURIER');
      throw new AppError(
        400,
        `Invalid status transition from ${delivery.status} to ${status}. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`
      );
    }
    
    // Validate proof image for DELIVERED status
    if (status === 'DELIVERED' && !proofImageUrl) {
      throw new AppError(400, 'Proof image is required when marking delivery as DELIVERED');
    }
    
    // Update delivery status
    updatedDelivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status }
    });
    
    // Create event for status update
    event = await createEvent({
      deliveryId,
      type: status,
      note: note || `Status updated to ${status}`,
      locationText,
      proofImageUrl: status === 'DELIVERED' ? proofImageUrl : undefined,
      userId: courierId
    });
  } else {
    // Add checkpoint - just add an event without changing status
    if (!status) {
      // Use current status as event type if no status provided
      const eventType = delivery.status;
      event = await createEvent({
        deliveryId,
        type: eventType,
        note: note || 'Checkpoint added',
        locationText,
        proofImageUrl,
        userId: courierId
      });
    } else {
      // Add checkpoint with specified status type
      event = await createEvent({
        deliveryId,
        type: status,
        note: note || 'Checkpoint added',
        locationText,
        proofImageUrl,
        userId: courierId
      });
    }
  }
  
  // Get updated delivery with relations
  const deliveryWithRelations = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
      assignments: {
        include: { courier: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { assignedAt: 'desc' }
      },
      events: {
        include: { createdBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  // Return response in format expected by courier agent
  res.json({
    success: true,
    message: action === 'updateStatus' ? 'Delivery status updated successfully' : 'Checkpoint added successfully',
    data: {
      delivery: deliveryWithRelations,
      event: {
        id: event.id,
        type: event.type,
        note: event.note,
        locationText: event.locationText,
        proofImageUrl: event.proofImageUrl,
        createdAt: event.createdAt,
        createdBy: {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role
        }
      },
      action: action
    }
  });
});

// Schema for getting courier's assigned deliveries
const courierDeliveriesSchema = z.object({
  courierId: z.string().uuid('Invalid courier ID format').optional()
});

// POST /agent/courier/delivery-details - Get all delivery details for assigned packages (requires COURIER role)
router.post('/agent/courier/delivery-details', requireAuth, requireRoles('COURIER'), validateBody(courierDeliveriesSchema), async (req, res) => {
  // Use courierId from request body or authenticated user's ID
  const requestedCourierId = req.body.courierId || req.user.id;
  const authenticatedCourierId = req.user.id;
  
  // Ensure courier can only access their own deliveries
  if (requestedCourierId !== authenticatedCourierId) {
    throw new AppError(403, 'You can only view your own assigned deliveries');
  }
  
  // Get all deliveries assigned to this courier
  const deliveries = await prisma.delivery.findMany({
    where: {
      assignments: {
        some: {
          courierId: requestedCourierId
        }
      }
    },
    include: {
      sender: { 
        select: { 
          id: true, 
          name: true, 
          email: true, 
          role: true 
        } 
      },
      assignments: { 
        include: { 
          courier: { 
            select: { 
              id: true, 
              name: true, 
              email: true, 
              role: true 
            } 
          } 
        }, 
        orderBy: { assignedAt: 'desc' } 
      },
      events: { 
        include: { 
          createdBy: { 
            select: { 
              id: true, 
              name: true, 
              role: true 
            } 
          } 
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
  
  // Return response in format expected by courier agent
  res.json({
    success: true,
    total: formattedDeliveries.length,
    data: formattedDeliveries
  });
});

module.exports = router;

