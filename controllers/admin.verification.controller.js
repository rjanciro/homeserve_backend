const User = require('../models/user.model');

exports.getPendingHousekeepers = async (req, res) => {
  try {
    const pendingHousekeepers = await User.find({
      userType: 'housekeeper',
      verificationStatus: 'pending'
    }).select('-password');
    
    res.json(pendingHousekeepers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllHousekeepers = async (req, res) => {
  try {
    const housekeepers = await User.find({
      userType: 'housekeeper'
    }).select('-password');
    
    res.json(housekeepers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyHousekeeper = async (req, res) => {
  try {
    console.log('Verification request received:', req.body);
    
    const { userId, approved, notes, documentReview } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update the user's verification status
    user.verificationStatus = approved ? 'approved' : 'rejected';
    
    // IMPORTANT: Also update the isVerified flag
    user.isVerified = approved;
    
    // Add to verification history
    user.verificationHistory = user.verificationHistory || [];
    user.verificationHistory.push({
      status: user.verificationStatus,
      date: new Date(),
      notes: notes || ''
    });
    
    await user.save();
    
    res.json({ 
      message: `Housekeeper ${approved ? 'approved' : 'rejected'} successfully`,
      user: {
        _id: user._id,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Error in verifyHousekeeper:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getHousekeeperDocuments = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.userType !== 'housekeeper') {
      return res.status(400).json({ message: 'User is not a housekeeper' });
    }
    
    res.json({
      housekeeper: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        verificationStatus: user.verificationStatus
      },
      documents: user.verificationDocuments || {},
      history: user.verificationHistory || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateHousekeeperStatus = async (req, res) => {
  try {
    const { housekeeperId } = req.params;
    const { isActive, notes } = req.body;
    
    if (!housekeeperId) {
      return res.status(400).json({ message: 'Housekeeper ID is required' });
    }
    
    const user = await User.findById(housekeeperId);
    
    if (!user) {
      return res.status(404).json({ message: 'Housekeeper not found' });
    }
    
    if (user.userType !== 'housekeeper') {
      return res.status(400).json({ message: 'User is not a housekeeper' });
    }
    
    // Update the housekeeper's active status
    user.isActive = isActive;
    user.statusNotes = notes;
    user.statusUpdateDate = new Date();
    
    // Add to status history
    user.statusHistory = user.statusHistory || [];
    user.statusHistory.push({
      status: isActive ? 'active' : 'disabled',
      date: new Date(),
      notes: notes || ''
    });
    
    await user.save();
    
    res.json({ 
      message: `Housekeeper ${isActive ? 'enabled' : 'disabled'} successfully`,
      housekeeper: {
        _id: user._id,
        isActive: user.isActive,
        statusNotes: user.statusNotes,
        statusUpdateDate: user.statusUpdateDate
      }
    });
  } catch (error) {
    console.error('Error updating housekeeper status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 