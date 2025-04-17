const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  housekeeper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  contactPhone: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    date: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded', 'partial'],
    default: 'unpaid'
  },
  paymentDetails: {
    amount: Number,
    method: String,
    transactionId: String,
    paymentDate: Date
  }
}, {
  timestamps: true
});

// Add an index for querying bookings by customer or housekeeper
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ housekeeper: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);