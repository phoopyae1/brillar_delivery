const express = require('express');
const prisma = require('../prisma');
const { validateBody } = require('../middleware/validate');
const { trackingCodeSchema } = require('../validators');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /public/agent/deliveries/trackingCode - Public API to get delivery details by tracking code (no auth required)
router.post('/public/agent/deliveries/trackingCode', validateBody(trackingCodeSchema), async (req, res) => {
  const trackingCode = req.body.trackingCode;
  
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode },
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
      pdfUrl: true,
      createdAt: true,
      sender: { select: { id: true, name: true, email: true, phone: true, role: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          note: true,
          proofImageUrl: true,
          locationText: true,
          createdAt: true,
          createdBy: { select: { name: true, phone: true, role: true } }
        }
      }
    }
  });
  
  if (!delivery) {
    throw new AppError(404, 'Delivery not found');
  }
  
  // Return response in format expected by public agent
  res.json({
    success: true,
    data: delivery
  });
});

module.exports = router;

