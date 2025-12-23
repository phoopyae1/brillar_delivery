const { z } = require('zod');

const roleEnum = z.enum(['SENDER', 'DISPATCHER', 'COURIER', 'ADMIN']);
const statusEnum = z.enum([
  'CREATED',
  'ASSIGNED_FOR_PICKUP',
  'PICKED_UP',
  'ARRIVED_AT_HUB',
  'DEPARTED_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED'
]);

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: roleEnum
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const createDeliverySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  receiverName: z.string().min(2),
  receiverPhone: z.string().min(5),
  pickupAddress: z.string().min(5),
  deliveryAddress: z.string().min(5),
  packageWeight: z.coerce.number().positive().optional(),
  packageDimensions: z.string().optional(),
  serviceType: z.string().optional()
});

const statusUpdateSchema = z.object({
  status: statusEnum,
  note: z.string().optional(),
  locationText: z.string().optional(),
  proofSignatureUrl: z.string().url().optional(),
  proofPhotoUrl: z.string().url().optional(),
  failureReason: z.string().optional()
});

const assignSchema = z.object({
  courierId: z.coerce.number().positive()
});

const eventSchema = z.object({
  type: statusEnum,
  note: z.string().optional(),
  locationText: z.string().optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  createDeliverySchema,
  statusUpdateSchema,
  assignSchema,
  eventSchema
};
