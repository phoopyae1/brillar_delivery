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
  role: z.enum(['SENDER', 'DISPATCHER', 'COURIER']).refine(
    (role) => role !== 'ADMIN',
    { message: 'Admin role cannot be created through registration' }
  ),
  phone: z.string().min(5).optional() // Phone number (optional, but recommended for senders)
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
  courierId: z.string().uuid('Invalid courier ID format')
});

const eventSchema = z.object({
  type: statusEnum,
  note: z.string().optional(),
  locationText: z.string().optional()
});

const integrationSchema = z.object({
  name: z.string().optional(),
  contextualKey: z.string().min(1, 'Contextual key is required'),
  iframeScriptTag: z.string().min(1, 'Iframe/Script tag is required'),
  role: z.enum(['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN']).optional()
});

const trackingCodeSchema = z.object({
  trackingCode: z.string().min(1, 'Tracking code is required')
});

const senderIdSchema = z.object({
  senderId: z.string().uuid('Invalid sender ID format').optional()
});

const priceCalculatorSchema = z.object({
  origin: z.string().min(2, 'Origin country code is required'),
  destination: z.string().min(2, 'Destination country code is required'),
  weight: z.number().positive('Weight must be a positive number').or(z.string().transform((val) => parseFloat(val)).pipe(z.number().positive())),
  serviceType: z.enum(['express', 'standard'], { errorMap: () => ({ message: 'Service type must be either "express" or "standard"' }) })
});

module.exports = {
  registerSchema,
  loginSchema,
  createDeliverySchema,
  statusUpdateSchema,
  assignSchema,
  eventSchema,
  integrationSchema,
  trackingCodeSchema,
  senderIdSchema,
  priceCalculatorSchema
};
