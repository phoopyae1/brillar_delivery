const express = require('express');
const prisma = require('../prisma');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  createDeliverySchema,
  statusUpdateSchema,
  assignSchema,
  eventSchema
} = require('../validators');
const { generateTrackingCode } = require('../utils/trackingCode');
const { canTransition, getAllowedTransitions } = require('../constants/statuses');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const requireAuth = [authMiddleware];

const includeDeliveryRelations = {
  sender: { select: { id: true, name: true, email: true, role: true } },
  assignments: { include: { courier: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { assignedAt: 'desc' } },
  events: { include: { createdBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } }
};

const createEvent = ({ deliveryId, type, note, locationText, userId }) =>
  prisma.deliveryEvent.create({
    data: { deliveryId, type, note, locationText, createdById: userId }
  });

const assertDeliveryAccess = async (user, deliveryId) => {
  const id = Number(deliveryId);
  if (!id || isNaN(id)) throw new AppError(400, 'Invalid delivery ID');
  
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { assignments: true }
  });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (user.role === 'ADMIN' || user.role === 'DISPATCHER') return delivery;
  if (user.role === 'SENDER' && delivery.senderId === user.id) return delivery;
  if (user.role === 'COURIER') {
    const assigned = delivery.assignments.some((a) => a.courierId === user.id);
    if (assigned) return delivery;
    throw new AppError(403, `Delivery ${deliveryId} is not assigned to you. Only assigned deliveries can be updated.`);
  }
  throw new AppError(403, 'Forbidden');
};

router.post('/deliveries', requireAuth, requireRoles('SENDER', 'ADMIN'), validateBody(createDeliverySchema), async (req, res) => {
  const senderId = req.user.id;
  const trackingCode = generateTrackingCode();
  const delivery = await prisma.delivery.create({
    data: {
      ...req.body,
      senderId,
      trackingCode,
      status: 'CREATED'
    }
  });
  await createEvent({ deliveryId: delivery.id, type: 'CREATED', note: 'Delivery created', userId: senderId });
  res.status(201).json(delivery);
});

router.get('/deliveries/:trackingCode/public', async (req, res) => {
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode: req.params.trackingCode },
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
      createdAt: true,
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          note: true,
          locationText: true,
          createdAt: true,
          createdBy: { select: { name: true, role: true } }
        }
      }
    }
  });
  if (!delivery) throw new AppError(404, 'Not found');
  res.json(delivery);
});

router.get('/deliveries/:id', requireAuth, async (req, res) => {
  const deliveryId = Number(req.params.id);
  await assertDeliveryAccess(req.user, deliveryId);
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: includeDeliveryRelations });
  res.json(delivery);
});

router.get('/me/deliveries', requireAuth, async (req, res) => {
  const role = req.user.role;
  let deliveries = [];
  const includeEvents = {
    events: {
      include: { createdBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' }
    }
  };
  
  if (role === 'SENDER') {
    deliveries = await prisma.delivery.findMany({ 
      where: { senderId: req.user.id }, 
      include: includeEvents,
      orderBy: { createdAt: 'desc' } 
    });
  } else if (role === 'COURIER') {
    deliveries = await prisma.delivery.findMany({
      where: { assignments: { some: { courierId: req.user.id } } },
      include: includeEvents,
      orderBy: { createdAt: 'desc' }
    });
  } else if (role === 'DISPATCHER') {
    deliveries = await prisma.delivery.findMany({ 
      include: includeEvents,
      orderBy: { createdAt: 'desc' } 
    });
  } else if (role === 'ADMIN') {
    deliveries = await prisma.delivery.findMany({ 
      include: includeEvents,
      orderBy: { createdAt: 'desc' } 
    });
  }
  res.json(deliveries);
});

router.patch(
  '/deliveries/:id/assign',
  requireAuth,
  requireRoles('DISPATCHER', 'ADMIN'),
  validateBody(assignSchema),
  async (req, res) => {
    const deliveryId = Number(req.params.id);
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new AppError(404, 'Not found');
    if (!['CREATED', 'ASSIGNED'].includes(delivery.status)) {
      throw new AppError(400, 'Cannot assign after pickup');
    }
    const courier = await prisma.user.findUnique({ where: { id: req.body.courierId } });
    if (!courier || courier.role !== 'COURIER') throw new AppError(400, 'Courier not found');
    const assignment = await prisma.assignment.create({ data: { courierId: req.body.courierId, deliveryId } });
    const updated = await prisma.delivery.update({ where: { id: deliveryId }, data: { status: 'ASSIGNED' } });
    await createEvent({ deliveryId, type: 'ASSIGNED', userId: req.user.id, note: `Assigned to ${courier.name}` });
    res.json({ assignment, delivery: updated });
  }
);

router.patch(
  '/deliveries/:id/status',
  requireAuth,
  requireRoles('COURIER', 'DISPATCHER', 'ADMIN', 'SENDER'),
  validateBody(statusUpdateSchema),
  async (req, res) => {
    const deliveryId = Number(req.params.id);
    const delivery = await assertDeliveryAccess(req.user, deliveryId);
    const nextStatus = req.body.status;
    if (!canTransition(delivery.status, nextStatus, req.user.role)) {
      const allowed = getAllowedTransitions(delivery.status, req.user.role);
      throw new AppError(
        400, 
        `Invalid status transition from ${delivery.status} to ${nextStatus}. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`
      );
    }
    const updated = await prisma.delivery.update({ where: { id: deliveryId }, data: { status: nextStatus } });
    const event = await createEvent({
      deliveryId,
      type: nextStatus,
      note: req.body.note,
      locationText: req.body.locationText,
      userId: req.user.id
    });
    res.json({ delivery: updated, event });
  }
);

router.post(
  '/deliveries/:id/events',
  requireAuth,
  requireRoles('COURIER', 'DISPATCHER', 'ADMIN'),
  validateBody(eventSchema),
  async (req, res) => {
    const deliveryId = Number(req.params.id);
    await assertDeliveryAccess(req.user, deliveryId);
    const event = await createEvent({
      deliveryId,
      type: req.body.type,
      note: req.body.note,
      locationText: req.body.locationText,
      userId: req.user.id
    });
    res.status(201).json(event);
  }
);

router.get('/deliveries', requireAuth, requireRoles('ADMIN', 'DISPATCHER'), async (req, res) => {
  const deliveries = await prisma.delivery.findMany({ include: includeDeliveryRelations, orderBy: { createdAt: 'desc' } });
  res.json(deliveries);
});

router.get('/couriers', requireAuth, requireRoles('DISPATCHER', 'ADMIN'), async (_req, res) => {
  const couriers = await prisma.user.findMany({
    where: { role: 'COURIER' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' }
  });
  res.json(couriers);
});

router.get('/stats', requireAuth, requireRoles('ADMIN'), async (_req, res) => {
  const [users, deliveries, delivered, inTransit] = await Promise.all([
    prisma.user.count(),
    prisma.delivery.count(),
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    prisma.delivery.count({ where: { status: 'IN_TRANSIT' } })
  ]);
  res.json({ users, deliveries, delivered, inTransit });
});

module.exports = router;
