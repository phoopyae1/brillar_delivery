const express = require('express');
const { validateBody } = require('../middleware/validate');
const { integrationSchema } = require('../validators');
const Integration = require('../models/Integration');
const { AppError } = require('../middleware/errorHandler');
const { mongoose } = require('../mongodb');

const router = express.Router();

// GET /integration - Get all integrations
router.get('/integration', async (_req, res) => {
  const integrations = await Integration.find({}).sort({ createdAt: -1 });
  res.json(integrations);
});

// GET /integration/:id - Get single integration by ID
router.get('/integration/:id', async (req, res) => {
  const integration = await Integration.findById(req.params.id);
  if (!integration) {
    throw new AppError(404, 'Integration not found');
  }
  res.json(integration);
});

// GET /integration/key/:key - Get integration by contextual key (public or authenticated)
router.get('/integration/key/:key', async (req, res) => {
  const integration = await Integration.findOne({ contextualKey: req.params.key });
  if (!integration) {
    throw new AppError(404, 'Integration not found');
  }
  res.json(integration);
});

// POST /integration - Create new integration
router.post('/integration', validateBody(integrationSchema), async (req, res) => {
  // Check MongoDB connection
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, 'Database connection not available. Please try again later.');
  }
  
  const { name, contextualKey, iframeScriptTag } = req.body;
  
  // Ensure name is set (use contextualKey if not provided or empty)
  const integrationName = (name && name.trim()) ? name.trim() : contextualKey.trim();
  
  // Check if contextual key already exists
  const existing = await Integration.findOne({ contextualKey });
  if (existing) {
    throw new AppError(400, 'Integration with this contextual key already exists');
  }
  
  const integration = new Integration({
    name: integrationName,
    contextualKey: contextualKey.trim(),
    iframeScriptTag: iframeScriptTag.trim()
  });
  
  const saved = await integration.save();
  res.status(201).json(saved);
});

// PUT /integration/:id - Update integration
router.put('/integration/:id', validateBody(integrationSchema), async (req, res) => {
  const { name, contextualKey, iframeScriptTag } = req.body;
  
  // Check if contextual key is being changed and if it conflicts
  const existing = await Integration.findById(req.params.id);
  if (!existing) {
    throw new AppError(404, 'Integration not found');
  }
  
  if (contextualKey !== existing.contextualKey) {
    const keyExists = await Integration.findOne({ contextualKey });
    if (keyExists) {
      throw new AppError(400, 'Integration with this contextual key already exists');
    }
  }
  
  const updated = await Integration.findByIdAndUpdate(
    req.params.id,
    {
      name: name || contextualKey, // Use contextualKey as name if not provided
      contextualKey,
      iframeScriptTag,
      updatedAt: Date.now()
    },
    { new: true, runValidators: true }
  );
  
  if (!updated) {
    throw new AppError(404, 'Integration not found');
  }
  
  res.json(updated);
});

// DELETE /integration/:id - Delete integration
router.delete('/integration/:id', async (req, res) => {
  const deleted = await Integration.findByIdAndDelete(req.params.id);
  if (!deleted) {
    throw new AppError(404, 'Integration not found');
  }
  res.json({ message: 'Integration deleted successfully', id: deleted._id });
});

module.exports = router;

