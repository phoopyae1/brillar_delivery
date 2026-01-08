const { mongoose } = require('../mongodb');

const senderIntegrationSchema = new mongoose.Schema({
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
}, { collection: 'sender_integrations' });

// Update the updatedAt field before saving
senderIntegrationSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

const SenderIntegration = mongoose.models.SenderIntegration || mongoose.model('SenderIntegration', senderIntegrationSchema);

module.exports = SenderIntegration;

