const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { check } = require('express-validator');
const auth = require('../middleware/auth');

// Validation middleware
const registerValidation = [
  check('firstName', 'First name is required').not().isEmpty(),
  check('lastName', 'Last name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
  check('userType', 'User type must be either homeowner or housekeeper').isIn(['homeowner', 'housekeeper'])
];

const loginValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/change-password', auth, authController.changePassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);
router.post('/verify-pin', authController.verifyPin);
router.post('/request-password-change-pin', auth, authController.requestPasswordChangePin);
router.post('/verify-password-change-pin', auth, authController.verifyPasswordChangePin);
router.post('/logout', auth, authController.logout);

module.exports = router;
