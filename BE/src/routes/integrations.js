const express = require('express');
const { validateBody } = require('../middleware/validate');
const { integrationSchema } = require('../validators');
const SenderIntegration = require('../models/SenderIntegration');
const CourierIntegration = require('../models/CourierIntegration');
const DispatcherIntegration = require('../models/DispatcherIntegration');
const PublicIntegration = require('../models/PublicIntegration');
const AdminIntegration = require('../models/AdminIntegration');
const { AppError } = require('../middleware/errorHandler');
const { mongoose } = require('../mongodb');

// Helper function to get the correct model based on role
const getIntegrationModel = (role) => {
  switch (role) {
    case 'SENDER':
      return SenderIntegration;
    case 'COURIER':
      return CourierIntegration;
    case 'DISPATCHER':
      return DispatcherIntegration;
    case 'PUBLIC':
      return PublicIntegration;
    case 'ADMIN':
      return AdminIntegration;
    default:
      return null;
  }
};

const router = express.Router();

// GET /integration - Get integrations (filtered by role if provided)
// Query params: ?role=SENDER|DISPATCHER|COURIER|PUBLIC|ADMIN
router.get('/integration', async (req, res) => {
  const { role } = req.query;
  
  // If role is specified, fetch from the specific role collection
  if (role && ['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN'].includes(role)) {
    const IntegrationModel = getIntegrationModel(role);
    if (!IntegrationModel) {
      return res.json([]);
    }
    
    // Get latest integration for the specified role from its collection
    // Sort by updatedAt, createdAt, then _id for deterministic ordering
    const integration = await IntegrationModel.findOne({})
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 });
    
    if (integration) {
      // Add role field to response for compatibility
      const result = integration.toObject();
      result.role = role;
      return res.json([result]);
    }
    return res.json([]);
  }
  
  // If no role specified, return PUBLIC integrations (for non-logged-in users)
  // Sort by updatedAt, createdAt, then _id for deterministic ordering
  const publicIntegrations = await PublicIntegration.find({})
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 });
  
  // Add role field to each integration for compatibility
  const result = publicIntegrations.map(integration => {
    const obj = integration.toObject();
    obj.role = 'PUBLIC';
    return obj;
  });
  
  res.json(result);
});

// GET /integration/:id - Get single integration by ID (requires role query param)
router.get('/integration/:id', async (req, res) => {
  const { role } = req.query;
  
  if (!role || !['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN'].includes(role)) {
    throw new AppError(400, 'Role query parameter is required (SENDER, DISPATCHER, COURIER, PUBLIC, or ADMIN)');
  }
  
  const IntegrationModel = getIntegrationModel(role);
  if (!IntegrationModel) {
    throw new AppError(404, 'Integration not found');
  }
  
  const integration = await IntegrationModel.findById(req.params.id);
  if (!integration) {
    throw new AppError(404, 'Integration not found');
  }
  
  const result = integration.toObject();
  result.role = role;
  res.json(result);
});

// GET /integration/key/:key - Get integration by contextual key (searches all collections)
router.get('/integration/key/:key', async (req, res) => {
  const key = req.params.key;
  
  // Search all role collections
  const collections = [
    { model: SenderIntegration, role: 'SENDER' },
    { model: CourierIntegration, role: 'COURIER' },
    { model: DispatcherIntegration, role: 'DISPATCHER' },
    { model: PublicIntegration, role: 'PUBLIC' },
    { model: AdminIntegration, role: 'ADMIN' }
  ];
  
  for (const { model, role } of collections) {
    const integration = await model.findOne({ contextualKey: key });
    if (integration) {
      const result = integration.toObject();
      result.role = role;
      return res.json(result);
    }
  }
  
  throw new AppError(404, 'Integration not found');
});

// POST /integration - Create new integration (requires role in body)
router.post('/integration', validateBody(integrationSchema), async (req, res) => {
  // Check MongoDB connection
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, 'Database connection not available. Please try again later.');
  }
  
  const { name, contextualKey, iframeScriptTag, role } = req.body;
  
  // Role is required for creating integrations
  if (!role || !['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN'].includes(role)) {
    throw new AppError(400, 'Role is required and must be one of: SENDER, DISPATCHER, COURIER, PUBLIC, ADMIN');
  }
  
  const IntegrationModel = getIntegrationModel(role);
  if (!IntegrationModel) {
    throw new AppError(400, 'Invalid role');
  }
  
  // Ensure name is set (use contextualKey if not provided or empty)
  const integrationName = (name && name.trim()) ? name.trim() : contextualKey.trim();
  
  // Delete all existing integrations for this role to ensure only one exists
  // This implements a "replace" pattern: one integration per role
  const deleteResult = await IntegrationModel.deleteMany({});
  console.log(`[Integration API] Deleted ${deleteResult.deletedCount} existing integration(s) for role ${role}`);
  
  // Create the new integration (now the only one for this role)
  const integration = new IntegrationModel({
    name: integrationName,
    contextualKey: contextualKey.trim(),
    iframeScriptTag: iframeScriptTag.trim()
  });
  
  const saved = await integration.save();
  const result = saved.toObject();
  result.role = role;
  res.status(201).json(result);
});

// PUT /integration/:id - Update integration (requires role in body)
router.put('/integration/:id', validateBody(integrationSchema), async (req, res) => {
  const { name, contextualKey, iframeScriptTag, role } = req.body;
  
  // Role is required for updating integrations
  if (!role || !['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN'].includes(role)) {
    throw new AppError(400, 'Role is required and must be one of: SENDER, DISPATCHER, COURIER, PUBLIC, ADMIN');
  }
  
  const IntegrationModel = getIntegrationModel(role);
  if (!IntegrationModel) {
    throw new AppError(400, 'Invalid role');
  }
  
  // Check if integration exists
  const existing = await IntegrationModel.findById(req.params.id);
  if (!existing) {
    throw new AppError(404, 'Integration not found');
  }
  
  // Ensure only one integration exists per role: delete all others except the one being updated
  const deleteResult = await IntegrationModel.deleteMany({ _id: { $ne: req.params.id } });
  console.log(`[Integration API] Deleted ${deleteResult.deletedCount} other integration(s) for role ${role} (keeping ID: ${req.params.id})`);
  
  // Update the integration
  const updated = await IntegrationModel.findByIdAndUpdate(
    req.params.id,
    {
      name: name || contextualKey, // Use contextualKey as name if not provided
      contextualKey: contextualKey.trim(),
      iframeScriptTag: iframeScriptTag.trim(),
      updatedAt: Date.now()
    },
    { new: true, runValidators: true }
  );
  
  if (!updated) {
    throw new AppError(404, 'Integration not found');
  }
  
  const result = updated.toObject();
  result.role = role;
  res.json(result);
});

// DELETE /integration/:id - Delete integration (requires role query param)
router.delete('/integration/:id', async (req, res) => {
  const { role } = req.query;
  
  if (!role || !['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN'].includes(role)) {
    throw new AppError(400, 'Role query parameter is required (SENDER, DISPATCHER, COURIER, PUBLIC, or ADMIN)');
  }
  
  const IntegrationModel = getIntegrationModel(role);
  if (!IntegrationModel) {
    throw new AppError(404, 'Integration not found');
  }
  
  const deleted = await IntegrationModel.findByIdAndDelete(req.params.id);
  if (!deleted) {
    throw new AppError(404, 'Integration not found');
  }
  
  res.json({ message: 'Integration deleted successfully', id: deleted._id });
});

module.exports = router;

