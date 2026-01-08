const express = require('express');
const prisma = require('../prisma');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { z } = require('zod');
const { createTransaction } = require('../utils/transaction');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const requireAuth = [authMiddleware];

// Helper function to create delivery event
const createEvent = ({ deliveryId, type, note, locationText, proofImageUrl, userId }) =>
  prisma.deliveryEvent.create({
    data: { deliveryId, type, note, locationText, proofImageUrl, createdById: userId }
  });

// Schema for assign courier request
const assignCourierSchema = z.object({
  deliveryId: z.string().uuid('Invalid delivery ID format'),
  courierName: z.string().min(1, 'Courier name is required')
});

// POST /agent/dispatcher/assign-courier - Assign courier to delivery (requires DISPATCHER role)
router.post('/agent/dispatcher/assign-courier', requireAuth, requireRoles('DISPATCHER', 'ADMIN'), validateBody(assignCourierSchema), async (req, res) => {
  const deliveryId = req.body.deliveryId;
  const courierName = req.body.courierName;
  const dispatcherId = req.user.id;
  
  // Check if delivery exists
  const delivery = await prisma.delivery.findUnique({ 
    where: { id: deliveryId },
    include: { assignments: true }
  });
  
  if (!delivery) {
    throw new AppError(404, 'Delivery not found');
  }
  
  // Check if delivery can be assigned (only CREATED or ASSIGNED status)
  if (!['CREATED', 'ASSIGNED'].includes(delivery.status)) {
    throw new AppError(400, 'Cannot assign courier after pickup. Delivery status must be CREATED or ASSIGNED');
  }
  
  // Find courier by name and role
  const courier = await prisma.user.findFirst({ 
    where: { 
      name: courierName.trim(),
      role: 'COURIER'
    } 
  });
  
  if (!courier) {
    throw new AppError(404, `Courier with name "${courierName}" not found`);
  }
  
  // Check if delivery is already assigned to this courier
  const existingAssignment = delivery.assignments.find(a => a.courierId === courier.id);
  if (existingAssignment) {
    throw new AppError(400, 'Delivery is already assigned to this courier');
  }
  
  // Create assignment
  const assignment = await prisma.assignment.create({ 
    data: { 
      courierId: courier.id, 
      deliveryId: deliveryId 
    } 
  });
  
  // Update delivery status to ASSIGNED if it's CREATED
  const updatedDelivery = await prisma.delivery.update({ 
    where: { id: deliveryId }, 
    data: { status: 'ASSIGNED' } 
  });
  
  // Create event
  await createEvent({ 
    deliveryId, 
    type: 'ASSIGNED', 
    userId: dispatcherId, 
    note: `Assigned to ${courier.name}` 
  });
  
  // Create transaction via Atenxion API (non-blocking)
  createTransaction(dispatcherId, {
    type: 'COURIER_ASSIGNED',
    deliveryId: delivery.id,
    trackingCode: delivery.trackingCode,
    courierId: courier.id,
    courierName: courier.name,
    status: updatedDelivery.status,
    assignedAt: assignment.assignedAt
  }, 'DISPATCHER').catch(err => {
    console.error('[Dispatcher Agent] Failed to create transaction:', err);
  });
  
  // Return response in format expected by dispatcher agent
  res.json({
    success: true,
    message: 'Courier assigned successfully',
    data: {
      assignment: {
        id: assignment.id,
        deliveryId: assignment.deliveryId,
        courierId: assignment.courierId,
        assignedAt: assignment.assignedAt,
        courier: {
          id: courier.id,
          name: courier.name,
          email: courier.email,
          role: courier.role
        }
      },
      delivery: {
        id: updatedDelivery.id,
        trackingCode: updatedDelivery.trackingCode,
        status: updatedDelivery.status,
        title: updatedDelivery.title
      }
    }
  });
});

// GET /agent/dispatcher/deliveries - Get all deliveries with route/status information (requires DISPATCHER role)
router.post('/agent/dispatcher/deliveries', requireAuth, requireRoles('DISPATCHER', 'ADMIN'), async (req, res) => {
  const deliveries = await prisma.delivery.findMany({
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
  
  // Format response with route condition information
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
    currentRoute: {
      status: delivery.status,
      assignedCourier: delivery.assignments.length > 0 ? {
        id: delivery.assignments[0].courier.id,
        name: delivery.assignments[0].courier.name,
        email: delivery.assignments[0].courier.email,
        assignedAt: delivery.assignments[0].assignedAt
      } : null,
      lastEvent: delivery.events.length > 0 ? {
        type: delivery.events[delivery.events.length - 1].type,
        note: delivery.events[delivery.events.length - 1].note,
        locationText: delivery.events[delivery.events.length - 1].locationText,
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
  
  // Return response in format expected by dispatcher agent
  res.json({
    success: true,
    total: formattedDeliveries.length,
    data: formattedDeliveries
  });
});

module.exports = router;

