const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication failed: No token provided' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID - Make sure this matches your mongodb document ID field
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Authentication failed: User not found' });
    }
    
    // Log the found user ID
    console.log('Found user in auth middleware:', {
      id: user._id.toString(),
      decodedId: decoded.userId
    });
    
    // Set user on request object - Use MongoDB's _id
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      userType: decoded.userType
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Authentication failed: Invalid token' });
  }
};

// Export both as a default and as a named export
module.exports = auth;
module.exports.authenticateJWT = auth;
