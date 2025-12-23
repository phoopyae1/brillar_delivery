const express = require('express');
const prisma = require('../prisma');
const { authMiddleware, requireRoles } = require('../auth');
const {
  createDeliverySchema,
  statusUpdateSchema,
  assignSchema,
  eventSchema
} = require('../validators');

const router = express.Router();

const ALLOWED_TRANSITIONS = {
  DRAFT: ['CREATED', 'CANCELLED'],
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'RETURNED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'RETURNED'],
  DELIVERED: [],
  CANCELLED: [],
  FAILED_DELIVERY: [],
  RETURNED: []
};

const requireAuth = [authMiddleware];

const createEvent = async ({ deliveryId, type, note, locationText, userId }) => {
  return prisma.deliveryEvent.create({
    data: { deliveryId, type, note, locationText, createdById: userId }
  });
};

router.post('/deliveries', requireAuth, requireRoles('SENDER', 'ADMIN', 'DISPATCHER'), async (req, res) => {
  const parsed = createDeliverySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { title, description, priority, receiverName, receiverPhone, destinationAddress } = parsed.data;
  const senderId = req.user.id;
  const trackingCode = `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const delivery = await prisma.delivery.create({
    data: {
      title,
      description,
      priority,
      receiverName,
      receiverPhone,
      destinationAddress,
      senderId,
      trackingCode,
      status: 'CREATED'
    }
  });
  await createEvent({ deliveryId: delivery.id, type: 'CREATED', userId: senderId, note: 'Delivery created' });
  res.json(delivery);
});

router.get('/deliveries/:trackingCode/public', async (req, res) => {
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode: req.params.trackingCode },
    include: {
      sender: { select: { name: true, email: true } },
      events: { include: { createdBy: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      assignments: { include: { courier: { select: { name: true, email: true } } }, orderBy: { assignedAt: 'desc' } }
    }
  });
  if (!delivery) return res.status(404).json({ message: 'Not found' });
  res.json(delivery);
});

router.get('/deliveries/:id', requireAuth, async (req, res) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      sender: true,
      events: { include: { createdBy: true }, orderBy: { createdAt: 'asc' } },
      assignments: { include: { courier: true }, orderBy: { assignedAt: 'desc' } }
    }
  });
  if (!delivery) return res.status(404).json({ message: 'Not found' });
  res.json(delivery);
});

router.get('/me/deliveries', requireAuth, async (req, res) => {
  const role = req.user.role;
  let deliveries;
  if (role === 'SENDER') {
    deliveries = await prisma.delivery.findMany({
      where: { senderId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
  } else if (role === 'COURIER') {
    deliveries = await prisma.delivery.findMany({
      where: {
        assignments: { some: { courierId: req.user.id } }
      },
      orderBy: { createdAt: 'desc' }
    });
  } else {
    deliveries = await prisma.delivery.findMany({ orderBy: { createdAt: 'desc' } });
  }
  res.json(deliveries);
});

router.patch('/deliveries/:id/assign', requireAuth, requireRoles('DISPATCHER', 'ADMIN'), async (req, res) => {
  const parsed = assignSchema.safeParse({ ...req.body, courierId: Number(req.body.courierId) });
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const deliveryId = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return res.status(404).json({ message: 'Not found' });
  if (!['CREATED', 'ASSIGNED'].includes(delivery.status)) {
    return res.status(400).json({ message: 'Cannot assign after pickup' });
  }
  const assignment = await prisma.assignment.create({
    data: { courierId: parsed.data.courierId, deliveryId }
  });
  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: { status: 'ASSIGNED' }
  });
  await createEvent({ deliveryId, type: 'ASSIGNED', userId: req.user.id, note: 'Courier assigned' });
  res.json({ assignment, delivery: updated });
});

const canTransition = (current, next, role) => {
  if (!ALLOWED_TRANSITIONS[current]) return false;
  if (role === 'SENDER') {
    return next === 'CANCELLED' && ['DRAFT', 'CREATED', 'ASSIGNED'].includes(current);
  }
  return ALLOWED_TRANSITIONS[current].includes(next);
};

router.patch('/deliveries/:id/status', requireAuth, requireRoles('COURIER', 'DISPATCHER', 'ADMIN', 'SENDER'), async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const deliveryId = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return res.status(404).json({ message: 'Not found' });
  const role = req.user.role;
  const nextStatus = parsed.data.status;
  if (!canTransition(delivery.status, nextStatus, role)) {
    return res.status(400).json({ message: 'Invalid status transition' });
  }
  const updated = await prisma.delivery.update({ where: { id: deliveryId }, data: { status: nextStatus } });
  const event = await createEvent({
    deliveryId,
    type: nextStatus,
    note: parsed.data.note,
    locationText: parsed.data.locationText,
    userId: req.user.id
  });
  res.json({ delivery: updated, event });
});

router.post('/deliveries/:id/events', requireAuth, requireRoles('COURIER', 'DISPATCHER', 'ADMIN'), async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const deliveryId = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return res.status(404).json({ message: 'Not found' });
  const event = await createEvent({
    deliveryId,
    type: parsed.data.type,
    note: parsed.data.note,
    locationText: parsed.data.locationText,
    userId: req.user.id
  });
  res.json(event);
});

router.get('/deliveries', requireAuth, requireRoles('ADMIN', 'DISPATCHER'), async (req, res) => {
  const deliveries = await prisma.delivery.findMany({
    include: {
      sender: true,
      assignments: { include: { courier: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 1 }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(deliveries);
});

router.get('/stats', requireAuth, requireRoles('ADMIN'), async (req, res) => {
  const [users, deliveries, delivered, inTransit] = await Promise.all([
    prisma.user.count(),
    prisma.delivery.count(),
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    prisma.delivery.count({ where: { status: 'IN_TRANSIT' } })
  ]);
  res.json({ users, deliveries, delivered, inTransit });
});

module.exports = router;
