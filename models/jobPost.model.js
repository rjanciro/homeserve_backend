const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApplicantSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  proposedRate: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  dateApplied: {
    type: Date,
    default: Date.now
  }
});

const JobPostSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  schedule: {
    type: {
      type: String,
      enum: ['recurring'],
      default: 'recurring',
      required: true
    },
    startDate: Date,
    endDate: Date,
    days: [String],
    frequency: String,
    time: String
  },
  skills: [{
    type: String
  }],
  budget: {
    type: {
      type: String,
      enum: ['fixed', 'range'],
      required: true
    },
    amount: Number,
    minAmount: Number,
    maxAmount: Number,
    rate: {
      type: String,
      enum: ['hourly', 'weekly', 'monthly'],
      required: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'hired', 'archived'],
    default: 'active'
  },
  homeownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicants: [ApplicantSchema],
  hiredPerson: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    startDate: Date,
    name: String
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

// Update the updatedAt field on save
JobPostSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('JobPost', JobPostSchema); 