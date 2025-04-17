const express = require('express');
const router = express.Router();
const browseController = require('../controllers/browse.controller');
const auth = require('../middleware/auth'); // Use homeowner auth if needed

// @route   GET api/browse/services
// @desc    Get active housekeepers with their available services for browsing
// @access  Private (Homeowner) or Public (adjust auth middleware)
router.get('/services', auth, browseController.getAvailableServicesWithHousekeepers); 

module.exports = router; 