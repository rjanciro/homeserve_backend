const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { uploadProfileImage, getUserProfile, updateProfile } = require('../controllers/profile.controller');

// Configure storage for profile images
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/profile_pictures');
  },
  filename: function(req, file, cb) {
    // Use userId in filename for easy identification
    const userId = req.user ? req.user.userId : 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${userId}-${uniqueSuffix}${ext}`);
  }
});

// Configure multer with increased file size limit
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Increased to 10MB
  },
  fileFilter: function(req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Routes
router.post('/upload-image', auth, upload.single('profileImage'), uploadProfileImage);
router.get('/', auth, getUserProfile);
router.put('/', auth, updateProfile);

// Add an error handler for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File is too large. Maximum size is 10MB.' 
      });
    }
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;