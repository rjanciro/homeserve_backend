const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordChangePinEmail } = require('../utils/emailService');

// Define exports at the beginning
const authController = {
  register: async (req, res) => {
    try {
      console.log('Registration attempt received:', { 
        ...req.body,
        password: '[REDACTED]' 
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { firstName, lastName, email, password, userType } = req.body;
      
      // Quick validation check
      if (userType !== 'homeowner' && userType !== 'housekeeper') {
        return res.status(400).json({
          errors: [{ msg: 'User type must be either homeowner or housekeeper' }]
        });
      }

      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        console.log('User already exists:', email);
        
        // Check if the user exists but is not verified
        if (!user.isEmailVerified) {
          console.log('User exists but is not verified:', email);
          
          // Generate a new verification PIN
          const verificationPin = Math.floor(100000 + Math.random() * 900000).toString();
          const verificationPinExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          
          // Update the user with new verification PIN
          user.verificationPin = verificationPin;
          user.verificationPinExpires = verificationPinExpires;
          await user.save();
          
          // Send new verification email
          try {
            const emailSent = await sendVerificationEmail(email, verificationPin);
            if (emailSent) {
              console.log(`New verification email sent to unverified user: ${email}`);
            }
          } catch (emailError) {
            console.error('Error sending verification email:', emailError);
          }
          
          return res.status(400).json({ 
            message: 'This account exists but is not verified', 
            needsVerification: true,
            email: email
          });
        }
        
        // Regular user exists case
        return res.status(400).json({ message: 'User already exists' });
      }

      // Generate a 6-digit PIN
      const verificationPin = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationPinExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      try {
        // Test User model creation before saving
        console.log(`Creating new ${userType} user...`);
        
        // Create new user with verification PIN
        if (userType === 'housekeeper') {
          console.log('Creating housekeeper-type user with schema:', User.discriminators.housekeeper.schema.paths);
          // Ensure we create a valid housekeeper model
          user = new User.discriminators.housekeeper({
            firstName,
            lastName,
            email,
            password,
            userType,
            verificationPin,
            verificationPinExpires,
            isEmailVerified: false
          });
        } else {
          console.log('Creating homeowner-type user with schema:', User.discriminators.homeowner.schema.paths);
          // Regular homeowner model
          user = new User.discriminators.homeowner({
            firstName,
            lastName,
            email,
            password,
            userType,
            verificationPin,
            verificationPinExpires,
            isEmailVerified: false
          });
        }

        console.log('New user object created, about to save:', { 
          id: user._id,
          userType: user.userType,
          model: user.constructor.modelName
        });
        
        await user.save();
        console.log('User saved successfully');

        // Try to send verification email
        try {
          const emailSent = await sendVerificationEmail(email, verificationPin);
          
          if (!emailSent) {
            console.warn(`Failed to send verification email to ${email}, but user was created`);
          } else {
            console.log(`Verification email with PIN sent successfully to ${email}`);
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
        
        // Return success response
        return res.status(201).json({
          message: 'Registration successful. Please check your email for a verification PIN.',
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            userType: user.userType,
            isEmailVerified: user.isEmailVerified
          }
        });
      } catch (modelError) {
        console.error('User model error:', modelError);
        return res.status(500).json({ 
          message: 'Server error creating user model',
          error: modelError.message
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },
  
  login: async (req, res) => {
    try {
      const { email, password, userType } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      console.log(`User found`);

      // Verify password
      const isMatch = await user.comparePassword(password);
      console.log(`Password verification completed`);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Verify userType matches
      if (user.userType !== userType) {
        return res.status(400).json({ 
          message: `This account is registered as a ${user.userType}. Please select the correct user type.`
        });
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return res.status(401).json({ 
          message: 'Please verify your email before logging in',
          needsVerification: true,
          email: user.email
        });
      }

      // Create JWT token
      const token = jwt.sign(
        { 
          userId: user._id.toString(),
          email: user.email,
          userType: user.userType
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isEmailVerified: user.isEmailVerified
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  changePassword: async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.userId;
      
      // Input validation
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }

      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify old password
      const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Just set the password directly and let the pre-save hook handle it
      user.password = newPassword;

      // Save the updated user
      await user.save();

      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  verifyEmail: async (req, res) => {
    try {
      const { token } = req.params;

      // Find user with the token as verificationPin and check if it's expired
      const user = await User.findOne({
        verificationPin: token,
        verificationPinExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ 
          message: 'Verification code is invalid or has expired' 
        });
      }

      // Update user as verified
      user.isEmailVerified = true;
      user.verificationPin = null;
      user.verificationPinExpires = null;
      await user.save();

      // Create JWT token
      const jwtToken = jwt.sign(
        { 
          userId: user._id.toString(),
          email: user.email,
          userType: user.userType
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.status(200).json({
        message: 'Email verification successful',
        token: jwtToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isEmailVerified: user.isEmailVerified
        }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  resendVerificationEmail: async (req, res) => {
    try {
      const { email } = req.body;

      // Find user with the email
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }

      // Generate a new 6-digit PIN
      const verificationPin = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationPinExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.verificationPin = verificationPin;
      user.verificationPinExpires = verificationPinExpires;
      await user.save();

      // Send verification email
      const emailSent = await sendVerificationEmail(email, verificationPin);

      if (!emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }

      res.status(200).json({ 
        message: 'Verification email has been sent' 
      });
    } catch (error) {
      console.error('Resend verification email error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  verifyPin: async (req, res) => {
    try {
      const { email, pin } = req.body;

      if (!email || !pin) {
        return res.status(400).json({ message: 'Email and PIN are required' });
      }

      // Find user with the email and PIN
      const user = await User.findOne({
        email: email,
        verificationPin: pin,
        verificationPinExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ 
          message: 'Invalid or expired verification PIN' 
        });
      }

      // Update user as verified
      user.isEmailVerified = true;
      user.verificationPin = null;
      user.verificationPinExpires = null;
      await user.save();

      // Create JWT token
      const token = jwt.sign(
        { 
          userId: user._id.toString(),
          email: user.email,
          userType: user.userType
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.status(200).json({
        message: 'Email verification successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isEmailVerified: user.isEmailVerified
        }
      });
    } catch (error) {
      console.error('PIN verification error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  requestPasswordChangePin: async (req, res) => {
    try {
      const { email } = req.body;
      const userId = req.user.userId;
      
      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify email matches the authenticated user
      if (user.email !== email) {
        return res.status(400).json({ message: 'Email does not match authenticated user' });
      }
      
      // Generate a 6-digit PIN
      const passwordChangePin = Math.floor(100000 + Math.random() * 900000).toString();
      const passwordChangePinExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Save the PIN to the user
      user.passwordChangePin = passwordChangePin;
      user.passwordChangePinExpires = passwordChangePinExpires;
      await user.save();
      
      // Send the PIN via email
      const emailSent = await sendPasswordChangePinEmail(email, passwordChangePin);
      
      if (!emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }
      
      res.status(200).json({ message: 'Password change PIN sent to your email' });
    } catch (error) {
      console.error('Request password change PIN error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  verifyPasswordChangePin: async (req, res) => {
    try {
      const { email, pin, newPassword } = req.body;
      const userId = req.user.userId;
      
      if (!email || !pin || !newPassword) {
        return res.status(400).json({ message: 'Email, PIN, and new password are required' });
      }
      
      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify email matches the authenticated user
      if (user.email !== email) {
        return res.status(400).json({ message: 'Email does not match authenticated user' });
      }
      
      // Check if PIN is valid and not expired
      if (user.passwordChangePin !== pin || !user.passwordChangePinExpires || 
          user.passwordChangePinExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired PIN' });
      }
      
      // Update password
      user.password = newPassword;
      user.passwordChangePin = null;
      user.passwordChangePinExpires = null;
      await user.save();
      
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Verify password change PIN error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

// Export the controller object with all methods
module.exports = authController;

// Then you can log to verify exports are working
console.log('Auth controller exports:', Object.keys(module.exports));
