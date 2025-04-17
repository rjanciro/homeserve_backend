const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

// Base user schema with ONLY common fields
const UserSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    default: null
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['homeowner', 'housekeeper', 'admin'],
    required: true
  },
  phone: {
    type: String,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  statusNotes: {
    type: String,
    default: ''
  },
  statusUpdateDate: {
    type: Date
  },
  statusHistory: [{
    status: String,
    date: Date,
    notes: String
  }],
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationPin: {
    type: String,
    default: null
  },
  verificationPinExpires: {
    type: Date,
    default: null
  },
  passwordChangePin: {
    type: String,
    default: null
  },
  passwordChangePinExpires: {
    type: Date,
    default: null
  }
}, { discriminatorKey: 'userType' });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

const HousekeeperSchema = User.discriminator('housekeeper', new Schema({
  experience: {
    type: String,
    default: null
  },
  specialties: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: null
  },
  houseNumber: {
    type: String,
    default: null
  },
  streetName: {
    type: String,
    default: null
  },
  barangay: {
    type: String,
    default: null
  },
  cityMunicipality: {
    type: String,
    default: null
  },
  province: {
    type: String,
    default: null
  },
  zipCode: {
    type: String,
    default: null
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  address: {
    type: Object,
    default: function() {
      return {
        houseNumber: this.houseNumber,
        streetName: this.streetName,
        barangay: this.barangay,
        cityMunicipality: this.cityMunicipality,
        province: this.province,
        zipCode: this.zipCode,
        latitude: this.latitude,
        longitude: this.longitude
      };
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_submitted', 'verified'],
    default: 'not_submitted'
  },
  verificationDocuments: {
    identificationCard: {
      files: [{
        id: String,
        filename: String,
        path: String,
        size: Number,
        mimetype: String,
        uploadDate: Date
      }],
      verified: {
        type: Boolean,
        default: false
      },
      uploadDate: Date,
      notes: String
    },
    certifications: {
      files: [{
        id: String,
        filename: String,
        path: String,
        size: Number,
        mimetype: String,
        uploadDate: Date
      }],
      verified: {
        type: Boolean,
        default: false
      },
      uploadDate: Date,
      notes: String
    }
  },
  verificationHistory: [{
    status: String,
    date: Date,
    notes: String,
    adminNotes: String
  }]
}));

// Homeowner-specific schema - Add homeowner-specific fields here
const HomeownerSchema = User.discriminator('homeowner', new Schema({
  houseNumber: {
    type: String,
    default: null
  },
  streetName: {
    type: String,
    default: null
  },
  barangay: {
    type: String,
    default: null
  },
  cityMunicipality: {
    type: String,
    default: null
  },
  province: {
    type: String,
    default: null
  },
  zipCode: {
    type: String,
    default: null
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  address: {
    type: Object,
    default: function() {
      return {
        houseNumber: this.houseNumber,
        streetName: this.streetName,
        barangay: this.barangay,
        cityMunicipality: this.cityMunicipality,
        province: this.province,
        zipCode: this.zipCode,
        latitude: this.latitude,
        longitude: this.longitude
      };
    }
  }
}));

module.exports = User;
