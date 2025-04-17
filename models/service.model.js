const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  housekeeper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  serviceLocation: {
    type: String,
    required: true
  },
  availability: {
    monday: Boolean,
    tuesday: Boolean,
    wednesday: Boolean,
    thursday: Boolean,
    friday: Boolean,
    saturday: Boolean,
    sunday: Boolean,
    startTime: String,
    endTime: String
  },
  estimatedCompletionTime: {
    type: String,
    required: true
  },
  pricingType: {
    type: String,
    enum: ['Fixed', 'Hourly'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  image: String,
  contactNumber: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);