const { z } = require('zod');

const roleEnum = z.enum(['SENDER', 'DISPATCHER', 'COURIER', 'ADMIN']);
const statusEnum = z.enum([
  'DRAFT',
  'CREATED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURNED'
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
  destinationAddress: z.string().min(5)
});

const statusUpdateSchema = z.object({
  status: statusEnum,
  note: z.string().optional(),
  locationText: z.string().optional(),
  proofImageUrl: z.string().optional() // Base64 encoded image for delivery proof
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
