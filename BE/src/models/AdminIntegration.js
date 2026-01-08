const { mongoose } = require('../mongodb');

const adminIntegrationSchema = new mongoose.Schema({
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
}, { collection: 'admin_integrations' });

// Update the updatedAt field before saving
adminIntegrationSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

const AdminIntegration = mongoose.models.AdminIntegration || mongoose.model('AdminIntegration', adminIntegrationSchema);

module.exports = AdminIntegration;

