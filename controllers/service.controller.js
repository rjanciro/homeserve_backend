const Service = require('../models/service.model');
const User = require('../models/user.model');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

exports.getHousekeeperServices = async (req, res) => {
  try {
    const services = await Service.find({ housekeeper: req.user.id });
    res.json(services);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.createService = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Debug logging
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('User ID:', req.user.id);
    
    // Check if the user is a housekeeper
    const user = await User.findById(req.user.id);
    console.log('User found:', !!user);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.userType !== 'housekeeper') {
      return res.status(403).json({ message: 'Only housekeepers can create services' });
    }
    
    // Check if the housekeeper is verified
    if (!user.isVerified && user.verificationStatus !== 'approved' && user.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        message: 'Your account needs to be verified by an administrator before you can create services',
        verificationStatus: user.verificationStatus
      });
    }

    // Check if the housekeeper is active - use strict comparison with false
    if (user.isActive === false) {
      return res.status(403).json({ 
        message: 'Your account has been disabled by an administrator. You cannot create services at this time.',
        statusNotes: user.statusNotes || 'No reason provided'
      });
    }

    // Parse availability if it's a string (FormData sends it as a string)
    let availability = req.body.availability;
    if (typeof availability === 'string') {
      try {
        availability = JSON.parse(availability);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid availability format' });
      }
    }

    // Create service object
    const newService = new Service({
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      serviceLocation: req.body.serviceLocation,
      availability: availability,
      estimatedCompletionTime: req.body.estimatedCompletionTime,
      pricingType: req.body.pricingType,
      price: req.body.price,
      isAvailable: req.body.isAvailable === 'true',
      contactNumber: req.body.contactNumber,
      housekeeper: req.user.id
    });

    // Add image if uploaded
    if (req.file) {
      newService.image = `/uploads/services_pictures/${req.file.filename}`;
    }

    const service = await newService.save();
    res.json(service);
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the housekeeper of this service
    if (service.housekeeper.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json(service);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.status(500).send('Server Error');
  }
};

exports.updateService = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Debug logging
    console.log('Update service - Request body:', req.body);
    console.log('Update service - Request file:', req.file);
    console.log('Update service - Service ID:', req.params.id);
    
    // Find the service by ID
    let service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Check ownership
    if (service.housekeeper.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to update this service' });
    }
    
    // Check if the housekeeper is active
    if (service.housekeeper.isActive === false) {
      return res.status(403).json({ 
        message: 'Your account has been disabled by an administrator. You cannot update services at this time.',
        statusNotes: service.housekeeper.statusNotes
      });
    }
    
    // Parse availability if it's a string
    let availability = req.body.availability;
    if (typeof availability === 'string') {
      try {
        availability = JSON.parse(availability);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid availability format' });
      }
    }
    
    // Build service fields object
    const serviceFields = {
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      serviceLocation: req.body.serviceLocation,
      availability: availability,
      estimatedCompletionTime: req.body.estimatedCompletionTime,
      pricingType: req.body.pricingType,
      price: req.body.price,
      isAvailable: req.body.isAvailable === 'true',
      contactNumber: req.body.contactNumber
    };
    
    // Handle image update if a new one is uploaded
    if (req.file) {
      // If there's an existing image, delete it
      if (service.image) {
        const oldImagePath = path.join(__dirname, '..', service.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Set new image path
      serviceFields.image = `/uploads/services_pictures/${req.file.filename}`;
    }
    
    // Update service
    service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: serviceFields },
      { new: true }
    );
    
    res.json(service);
  } catch (err) {
    console.error('Update service error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the housekeeper of this service
    if (service.housekeeper.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await service.deleteOne();
    res.json({ message: 'Service removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.status(500).send('Server Error');
  }
};

exports.toggleAvailability = async (req, res) => {
  const { isAvailable } = req.body;

  try {
    let service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the housekeeper of this service
    if (service.housekeeper.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Check if the housekeeper is active
    if (service.housekeeper.isActive === false) {
      return res.status(403).json({ 
        message: 'Your account has been disabled by an administrator. You cannot update services at this time.',
        statusNotes: service.housekeeper.statusNotes
      });
    }

    // Update availability
    service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: { isAvailable } },
      { new: true }
    );

    res.json(service);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.status(500).send('Server Error');
  }
};

// Get all available services for homeowners
exports.getAllServices = async (req, res) => {
  try {
    console.log('Fetching all services...');
    
    // Apply filters including isAvailable=true directly in the database query
    const services = await Service.find({ isAvailable: true })
      .populate({
        path: 'housekeeper',
        select: 'firstName lastName profileImage businessName isVerified isActive',
      });
    
    console.log(`Total available services: ${services.length}`);
    
    // Only return services with active housekeepers
    const activeServices = services.filter(service => 
      service.housekeeper !== null && service.housekeeper.isActive !== false
    );
    
    console.log(`Services with active housekeepers: ${activeServices.length}`);
    
    res.json(activeServices);
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ message: 'Server Error', error: err.message, stack: err.stack });
  }
}; 