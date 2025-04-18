const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');

/**
 * Create a new booking
 */
exports.createBooking = async (req, res) => {
  try {
    const { serviceId, date, time, location, contactPhone, notes } = req.body;

    // Get the current authenticated user (customer)
    const customerId = req.user.id;

    // Validate required fields
    if (!serviceId || !date || !time || !location || !contactPhone) {
      return res.status(400).json({ 
        message: 'Service ID, date, time, location, and contact phone are required' 
      });
    }

    // Get service details to check if it exists and to get the housekeeper ID
    const service = await Service.findById(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Create booking with initial status "pending"
    const newBooking = new Booking({
      service: serviceId,
      customer: customerId,
      housekeeper: service.housekeeper,
      date: new Date(date),
      time,
      location,
      contactPhone,
      notes: notes || '',
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        notes: 'Booking request created'
      }]
    });

    // Save the booking
    await newBooking.save();

    res.status(201).json({
      message: 'Booking created successfully',
      booking: newBooking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get all bookings for the authenticated customer
 */
exports.getCustomerBookings = async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Validate if the user is a homeowner
    if (req.user.userType !== 'homeowner') {
      return res.status(403).json({ message: 'Access denied. Only homeowners can view their bookings.' });
    }

    const bookings = await Booking.find({ customer: customerId })
      .populate('service', 'name category image price pricingType')
      .populate('housekeeper', 'firstName lastName businessName profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching customer bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get all bookings for the authenticated housekeeper
 */
exports.getHousekeeperBookings = async (req, res) => {
  try {
    const housekeeperId = req.user.id;
    
    // Validate if the user is a housekeeper
    if (req.user.userType !== 'housekeeper') {
      return res.status(403).json({ message: 'Access denied. Only housekeepers can view their bookings.' });
    }

    const bookings = await Booking.find({ housekeeper: housekeeperId })
      .populate('service', 'name category image price pricingType')
      .populate('customer', 'firstName lastName profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching housekeeper bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get booking by ID
 */
exports.getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId)
      .populate('service', 'name category description image price pricingType')
      .populate('housekeeper', 'firstName lastName businessName profileImage phone')
      .populate('customer', 'firstName lastName profileImage phone');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if the user is authorized to view this booking
    if (booking.customer._id.toString() !== userId && 
        booking.housekeeper._id.toString() !== userId && 
        req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to view this booking' });
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update booking status
 */
exports.updateBookingStatus = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { status, note, notes } = req.body;  // Extract both 'note' and 'notes' parameters
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check permissions based on the requested status change
    if ((status === 'confirmed' || status === 'rejected') && 
        booking.housekeeper.toString() !== userId && 
        req.user.userType !== 'admin') {
      return res.status(403).json({ 
        message: 'Only the housekeeper or admin can confirm or reject bookings' 
      });
    }

    if (status === 'cancelled' && 
        booking.customer.toString() !== userId && 
        req.user.userType !== 'admin') {
      return res.status(403).json({ 
        message: 'Only the customer or admin can cancel bookings' 
      });
    }

    // Get the note from either 'note' or 'notes' parameter
    const noteContent = note || notes || `Status updated to ${status}`;
    
    // Update booking status
    booking.status = status;
    booking.statusHistory.push({
      status,
      notes: noteContent
    });

    await booking.save();

    res.status(200).json({
      message: `Booking status updated to ${status}`,
      booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Cancel booking
 */
exports.cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason } = req.body;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user is authorized to cancel this booking
    if (booking.customer.toString() !== userId && 
        booking.housekeeper.toString() !== userId && 
        req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to cancel this booking' });
    }

    // Cannot cancel a completed booking
    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed booking' });
    }

    // Update booking
    booking.status = 'cancelled';
    booking.statusHistory.push({
      status: 'cancelled',
      notes: reason || 'Booking cancelled'
    });

    await booking.save();

    res.status(200).json({
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Complete booking
 */
exports.completeBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only the housekeeper or admin can mark a booking as completed
    if (booking.housekeeper.toString() !== userId && req.user.userType !== 'admin') {
      return res.status(403).json({ 
        message: 'Only the housekeeper or admin can mark a booking as completed' 
      });
    }

    // Booking must be confirmed first
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ 
        message: 'Only confirmed bookings can be marked as completed' 
      });
    }

    // Update booking
    booking.status = 'completed';
    booking.statusHistory.push({
      status: 'completed',
      notes: 'Service completed'
    });

    await booking.save();

    res.status(200).json({
      message: 'Booking marked as completed',
      booking
    });
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update booking payment status
 */
exports.updatePaymentStatus = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { paymentStatus, paymentDetails } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!paymentStatus) {
      return res.status(400).json({ message: 'Payment status is required' });
    }

    // Validate payment status
    const validPaymentStatuses = ['unpaid', 'paid', 'refunded', 'partial'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status' });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only the housekeeper or admin can update payment status
    if (booking.housekeeper.toString() !== userId && req.user.userType !== 'admin') {
      return res.status(403).json({ 
        message: 'Only the housekeeper or admin can update payment status' 
      });
    }

    // Update payment information
    booking.paymentStatus = paymentStatus;
    if (paymentDetails) {
      booking.paymentDetails = {
        ...booking.paymentDetails,
        ...paymentDetails,
        paymentDate: paymentDetails.paymentDate || new Date()
      };
    }

    // Add to status history
    booking.statusHistory.push({
      status: booking.status,
      notes: `Payment status updated to ${paymentStatus}`
    });

    await booking.save();

    res.status(200).json({
      message: 'Payment status updated successfully',
      booking
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};