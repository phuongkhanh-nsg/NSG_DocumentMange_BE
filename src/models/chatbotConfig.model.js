const mongoose = require('mongoose');

const chatbotConfigSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: false },
  geminiApiKey: { type: String, default: '' },
  primaryColor: { type: String, default: '#FDC700' },
  position: { type: String, default: 'left' },
  width: { type: String, default: '350px' },
  height: { type: String, default: '480px' },
}, { timestamps: true });

module.exports = mongoose.model('ChatbotConfig', chatbotConfigSchema);
