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

// POST /agent/dispatcher-profile - Get dispatcher profile details with assignment statistics (requires DISPATCHER role)
router.post('/agent/dispatcher-profile', requireAuth, requireRoles('DISPATCHER', 'ADMIN'), async (req, res) => {
  const dispatcherId = req.user.id;
  
  // Get dispatcher user information
  const dispatcher = await prisma.user.findUnique({
    where: { id: dispatcherId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });
  
  if (!dispatcher) {
    throw new AppError(404, 'Dispatcher not found');
  }
  
  // Calculate date for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get all assignments made by this dispatcher (via events where type is ASSIGNED and createdBy is dispatcher)
  const assignmentEvents = await prisma.deliveryEvent.findMany({
    where: {
      type: 'ASSIGNED',
      createdById: dispatcherId
    },
    include: {
      delivery: {
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          trackingCode: true
        }
      }
    }
  });
  
  // Get all deliveries that have been assigned (to get full statistics)
  const allDeliveries = await prisma.delivery.findMany({
    where: {
      assignments: {
        some: {}
      }
    },
    include: {
      assignments: {
        include: {
          courier: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      events: {
        where: {
          type: 'ASSIGNED',
          createdById: dispatcherId
        }
      }
    }
  });
  
  // Filter deliveries that were assigned by this dispatcher
  const dispatcherAssignedDeliveries = allDeliveries.filter(delivery => 
    delivery.events.some(event => event.createdById === dispatcherId)
  );
  
  // Calculate statistics
  const totalAssignments = assignmentEvents.length;
  
  // Count by status for assigned deliveries
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
  
  // Count recent assignments (last 30 days)
  let recentAssignmentsLast30Days = 0;
  let recentDeliveredLast30Days = 0;
  let recentAssignedLast30Days = 0;
  
  dispatcherAssignedDeliveries.forEach(delivery => {
    // Count by status
    if (deliveriesByStatus.hasOwnProperty(delivery.status)) {
      deliveriesByStatus[delivery.status]++;
    }
    
    // Count by priority
    if (deliveriesByPriority.hasOwnProperty(delivery.priority)) {
      deliveriesByPriority[delivery.priority]++;
    }
    
    // Count recent assignments
    const assignmentEvent = delivery.events.find(e => e.createdById === dispatcherId);
    if (assignmentEvent && new Date(assignmentEvent.createdAt) >= thirtyDaysAgo) {
      recentAssignedLast30Days++;
      if (delivery.status === 'DELIVERED') {
        recentDeliveredLast30Days++;
      }
    }
  });
  
  // Get unique couriers assigned
  const uniqueCouriers = new Set();
  dispatcherAssignedDeliveries.forEach(delivery => {
    delivery.assignments.forEach(assignment => {
      if (assignment.courier) {
        uniqueCouriers.add(assignment.courier.id);
      }
    });
  });
  
  // Format dates
  const createdAtDate = new Date(dispatcher.createdAt);
  const userCreatedAt = createdAtDate.toISOString().split('T')[0];
  const userCreatedTime = createdAtDate.toTimeString().split(' ')[0];
  
  // Return response in format expected by dispatcher agent
  res.json({
    status: 'Success',
    userId: dispatcher.id,
    userEmail: dispatcher.email,
    userName: dispatcher.name,
    userRole: dispatcher.role,
    userStatus: 'active',
    userCreatedAt: userCreatedAt,
    userCreatedTime: userCreatedTime,
    userUpdatedAt: userCreatedAt, // Using createdAt as updatedAt since we don't have updatedAt field
    totalAssignments: totalAssignments,
    uniqueCouriersAssigned: uniqueCouriers.size,
    deliveriesByStatus: deliveriesByStatus,
    deliveriesByPriority: deliveriesByPriority,
    recentAssignmentsLast30Days: recentAssignedLast30Days,
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

