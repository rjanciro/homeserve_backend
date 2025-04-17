const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up storage for service images
const serviceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/services_pictures');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'service-' + uniqueSuffix + ext);
  }
});

// Set up storage for profile images
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create directory if it doesn't exist
    const uploadDir = path.join(__dirname, '..', 'uploads/profile_pictures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp and random suffix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Set up multer for service images
const uploadServiceImage = multer({
  storage: serviceStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFilter
}).single('serviceImage');

// Set up multer for profile images
const uploadProfileImage = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFilter
}).single('profileImage');

// Middleware wrapper for service image upload
const serviceImageUpload = (req, res, next) => {
  uploadServiceImage(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        message: err.message || 'Error uploading file' 
      });
    }
    console.log('Service file upload successful:', req.file);
    next();
  });
};

// Middleware wrapper for profile image upload
const profileImageUpload = (req, res, next) => {
  uploadProfileImage(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        message: err.message || 'Error uploading file' 
      });
    }
    console.log('Profile file upload successful:', req.file);
    next();
  });
};

module.exports = {
  serviceImageUpload,
  profileImageUpload
};
