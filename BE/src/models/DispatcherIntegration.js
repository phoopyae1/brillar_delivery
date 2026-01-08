const { mongoose } = require('../mongodb');

const dispatcherIntegrationSchema = new mongoose.Schema({
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
}, { collection: 'dispatcher_integrations' });

// Update the updatedAt field before saving
dispatcherIntegrationSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

const DispatcherIntegration = mongoose.models.DispatcherIntegration || mongoose.model('DispatcherIntegration', dispatcherIntegrationSchema);

module.exports = DispatcherIntegration;

