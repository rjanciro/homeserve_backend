const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const auth = require('../middleware/auth');
const { serviceImageUpload } = require('../middleware/upload');

// All routes require authentication
router.use(auth);

// Get all available services for homeowners
router.get('/', serviceController.getAllServices);

// Get all services for the logged-in housekeeper
router.get('/housekeeper', serviceController.getHousekeeperServices);

// Create a new service - add file upload middleware
router.post('/', serviceImageUpload, serviceController.createService);

// Debug route - get all services without filtering (for troubleshooting)
router.get('/debug/all', async (req, res) => {
  try {
    const Service = require('../models/service.model');
    const services = await Service.find().populate('housekeeper');
    res.json(services);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a specific service
router.get('/:id', serviceController.getServiceById);

// Update a service - add file upload middleware
router.put('/:id', serviceImageUpload, serviceController.updateService);

// Delete a service
router.delete('/:id', serviceController.deleteService);

// Toggle service availability
router.patch('/:id/availability', serviceController.toggleAvailability);

module.exports = router;