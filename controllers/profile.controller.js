const User = require('../models/user.model');
const fs = require('fs');
const path = require('path');

exports.uploadProfileImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log("File upload details:", req.file);
    const userId = req.user.userId;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user already has a profile image, delete the old file if it exists
    if (user.profileImage) {
      try {
        const oldImagePath = path.join(__dirname, '..', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`Deleted old profile image: ${oldImagePath}`);
        }
      } catch (deleteError) {
        console.error('Error deleting old profile image:', deleteError);
        // Continue with the update even if deletion fails
      }
    }

    // Create relative path to the uploaded file
    const imagePath = `/uploads/profile_pictures/${req.file.filename}`;
    console.log(`New profile image path: ${imagePath}`);

    // Update user with new image path
    user.profileImage = imagePath;
    await user.save();

    // Create full URL to return to client
    const imageUrl = `${process.env.SERVER_URL || 'http://localhost:8080'}${imagePath}`;
    console.log(`Full image URL: ${imageUrl}`);

    // Return success response
    res.status(200).json({ 
      message: 'Profile image uploaded successfully',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ message: 'Server error uploading image' });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;
    
    console.log('Received update request for userId:', userId);
    console.log('Update data:', updates);
    
    // First, get the user to check their type
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User type:', existingUser.userType);
    
    // Expand the list of allowed updates to include all fields
    const allowedUpdates = [
      'firstName', 'lastName', 'middleName', 'phone', 
      'businessName', 'businessDescription', 'bio',
      'houseNumber', 'streetName', 'barangay', 
      'cityMunicipality', 'province', 'zipCode',
      'latitude', 'longitude', 'experience', 'specialties'
    ];
    
    console.log('Before filtering:', Object.keys(updates));
    
    // Filter updates (if needed)
    const validUpdates = Object.keys(updates)
      .filter(update => allowedUpdates.includes(update))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});
    
    console.log('Valid updates after filtering:', validUpdates);
    
    // Instead of using findByIdAndUpdate, update the existing user object directly
    Object.keys(validUpdates).forEach(key => {
      existingUser[key] = validUpdates[key];
    });
    
    // Update the address field as well (if it's a computed field it might need special handling)
    if (existingUser.address) {
      existingUser.address = {
        houseNumber: existingUser.houseNumber,
        streetName: existingUser.streetName,
        barangay: existingUser.barangay,
        cityMunicipality: existingUser.cityMunicipality,
        province: existingUser.province,
        zipCode: existingUser.zipCode,
        latitude: existingUser.latitude,
        longitude: existingUser.longitude
      };
    }
    
    // Save the updated user
    await existingUser.save();
    
    // Log what's being sent back
    const userResponse = existingUser.toObject();
    delete userResponse.password;
    console.log('Updated user:', userResponse);
    
    res.json(userResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
