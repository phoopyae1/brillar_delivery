const { mongoose } = require('../mongodb');

const courierIntegrationSchema = new mongoose.Schema({
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
}, { collection: 'courier_integrations' });

// Update the updatedAt field before saving
courierIntegrationSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

const CourierIntegration = mongoose.models.CourierIntegration || mongoose.model('CourierIntegration', courierIntegrationSchema);

module.exports = CourierIntegration;

