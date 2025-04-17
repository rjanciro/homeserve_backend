const AdminUser = require('../models/adminUser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/user.model');

// @route   POST api/admin/login
// @desc    Authenticate admin & get token
// @access  Public
exports.loginAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    // Find the admin by username
    const admin = await AdminUser.findOne({ username });

    if (!admin) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // If credentials are valid, create and return JWT token
    const payload = {
      admin: {
        id: admin.id,
        role: admin.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '12h' },
      (err, token) => {
        if (err) throw err;
        
        // Return the token and admin info without the password
        const adminData = {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          phone: admin.phone
        };
        
        res.json({ token, admin: adminData });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @route   GET api/admin/me
// @desc    Get current admin profile
// @access  Private/Admin
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.admin.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }
    
    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getAllHousekeepers = async (req, res) => {
  try {
    const housekeepers = await User.find({ userType: 'housekeeper' }).select('-password');
    res.json(housekeepers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getHousekeeperDocuments = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("Finding housekeeper with ID:", userId);
    
    const user = await User.findById(userId);
    
    if (!user) {
      console.log("No user found with ID:", userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log("Found user:", user.email, "User type:", user.userType);
    
    // Create a transformed version of the documents with proper URL structure
    const transformedDocuments = {};
    
    // Check if verificationDocuments exists
    if (!user.verificationDocuments) {
      console.log("User has no verification documents");
      // Return empty documents instead of failing
      return res.json({
        housekeeper: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImage: user.profileImage,
          businessName: user.businessName,
          bio: user.bio,
          verificationStatus: user.verificationStatus || 'pending'
        },
        documents: {},
        history: user.verificationHistory || []
      });
    }
    
    // Log the document structure
    console.log("Document types:", Object.keys(user.verificationDocuments));
    
    // Go through each document type
    for (const docType in user.verificationDocuments) {
      if (user.verificationDocuments[docType] && user.verificationDocuments[docType].files) {
        console.log(`Processing ${docType} with ${user.verificationDocuments[docType].files.length} files`);
        
        transformedDocuments[docType] = {
          verified: user.verificationDocuments[docType].verified,
          uploadDate: user.verificationDocuments[docType].uploadDate,
          notes: user.verificationDocuments[docType].notes,
          files: user.verificationDocuments[docType].files.map(file => {
            const fileUrl = file && file.path ? file.path : '';
            return {
              id: file.id || file._id,
              filename: file.filename,
              url: fileUrl,
              uploadDate: file.uploadDate,
              mimetype: file.mimetype,
              verified: file.verified || false,
              size: file.size
            };
          })
        };
      } else {
        console.log(`Document type ${docType} has no files or is not properly structured`);
      }
    }
    
    // Return the transformed documents
    res.json({
      housekeeper: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        businessName: user.businessName,
        bio: user.bio,
        verificationStatus: user.verificationStatus
      },
      documents: transformedDocuments,
      history: user.verificationHistory || []
    });
  } catch (error) {
    console.error('Error getting housekeeper documents:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 