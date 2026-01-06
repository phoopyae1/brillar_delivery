const { mongoose } = require('../mongodb');

const integrationSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
integrationSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

const Integration = mongoose.models.Integration || mongoose.model('Integration', integrationSchema);

module.exports = Integration;

