const { mongoose } = require('../mongodb');

const publicIntegrationSchema = new mongoose.Schema({
  contextualKey: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  iframeScriptTag: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: false,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'public_integrations' });

// Update the updatedAt field before saving
publicIntegrationSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

const PublicIntegration = mongoose.models.PublicIntegration || mongoose.model('PublicIntegration', publicIntegrationSchema);

module.exports = PublicIntegration;

