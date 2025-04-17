const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const bookingController = require('../controllers/booking.controller');

// Create a new booking
router.post('/', authenticateJWT, bookingController.createBooking);

// Get all bookings for a customer
router.get('/customer', authenticateJWT, bookingController.getCustomerBookings);

// Get all bookings for a housekeeper
router.get('/housekeeper', authenticateJWT, bookingController.getHousekeeperBookings);

// Get booking by ID
router.get('/:id', authenticateJWT, bookingController.getBookingById);

// Update booking status
router.patch('/:id/status', authenticateJWT, bookingController.updateBookingStatus);

// Cancel booking
router.patch('/:id/cancel', authenticateJWT, bookingController.cancelBooking);

// Complete booking
router.patch('/:id/complete', authenticateJWT, bookingController.completeBooking);

// Update booking payment status
router.patch('/:id/payment', authenticateJWT, bookingController.updatePaymentStatus);

module.exports = router;