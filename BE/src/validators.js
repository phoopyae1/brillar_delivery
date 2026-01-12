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
  // Basic delivery info
  title: z.string().min(3).optional(),
  description: z.string().min(3).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  
  // Receiver info
  receiverName: z.string().min(2),
  receiverPhone: z.string().min(5),
  destinationAddress: z.string().min(5),
  recipientPostalCode: z.string().optional(),
  destinationCountry: z.string().optional(),
  
  // Sender info (optional - can use authenticated user)
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional(),
  senderPhone: z.string().optional(),
  senderAddress: z.string().optional(),
  senderPostalCode: z.string().optional(),
  originCountry: z.string().optional(),
  
  // Shipment details
  shipmentType: z.enum(['documents', 'packages']).optional(),
  documentType: z.string().optional(),
  packageSize: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  serviceType: z.enum(['express', 'standard']).optional(),
  
  // Payment and schedule
  paymentMethod: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  calculatedPrice: z.number().optional(),
  deliveryDays: z.number().optional()
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
