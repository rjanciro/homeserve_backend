const User = require('../models/user.model');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '../uploads/verification');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const userId = req.user.id;
    const docType = req.params.docType;
    const extension = path.extname(file.originalname);
    cb(null, `${userId}_${docType}_${uuidv4()}${extension}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF files are allowed'), false);
  }
};

// Configure the upload middleware
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).array('documents', 5); // Allow up to 5 files

exports.uploadDocument = async (req, res) => {
  try {
    const docType = req.params.docType;
    const userId = req.user.id;
    
    // Validate document type
    const validDocTypes = ['identificationCard', 'certifications'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }
    
    // Check if user exists and is a housekeeper
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.userType !== 'housekeeper') {
      return res.status(403).json({ message: 'Only housekeepers can upload verification documents' });
    }
    
    // Process file upload
    upload(req, res, async function(err) {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ 
          message: err.message || 'Error uploading documents' 
        });
      }
      
      // If no files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files were uploaded' });
      }
      
      // Initialize verification documents if needed
      if (!user.verificationDocuments) {
        user.verificationDocuments = {};
      }
      
      // Initialize document type if needed
      if (!user.verificationDocuments[docType]) {
        user.verificationDocuments[docType] = {
          files: [],
          verified: false
        };
      }
      
      // Add new files to the document type
      const uploadTime = new Date();
      const newFiles = req.files.map(file => {
        // Store relative path to avoid exposing server structure
        const relativePath = `/uploads/verification/${file.filename}`;
        return {
          id: uuidv4(),
          filename: file.originalname,
          path: relativePath,
          size: file.size,
          mimetype: file.mimetype,
          uploadDate: uploadTime
        };
      });
      
      // Add the new files to the document collection
      user.verificationDocuments[docType].files = [
        ...user.verificationDocuments[docType].files,
        ...newFiles
      ];
      
      // Update document status
      user.verificationDocuments[docType].uploadDate = uploadTime;
      user.verificationDocuments[docType].verified = false;
      
      // If user's verification status was rejected, set it back to pending
      if (user.verificationStatus === 'rejected') {
        user.verificationStatus = 'pending';
        
        // Add to verification history
        if (!user.verificationHistory) {
          user.verificationHistory = [];
        }
        
        user.verificationHistory.push({
          status: 'pending',
          date: new Date(),
          notes: 'Documents resubmitted after rejection'
        });
      }
      
      // After documents are successfully uploaded, update the verification status
      if (user.verificationStatus === 'not submitted' || user.verificationStatus === 'rejected') {
        user.verificationStatus = 'pending';
        
        // Add to verification history
        if (!user.verificationHistory) {
          user.verificationHistory = [];
        }
        
        user.verificationHistory.push({
          status: 'pending',
          date: new Date(),
          notes: 'Documents submitted for verification'
        });
      }
      
      // Save the updated user document
      await user.save();
      
      // Return information about the uploaded files
      res.json({
        message: 'Documents uploaded successfully',
        files: newFiles,
        documentStatus: user.verificationDocuments[docType],
        verificationStatus: user.verificationStatus
      });
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDocumentStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Log the status to debug
    console.log('User verification status:', user.verificationStatus);
    
    res.json({
      status: user.verificationStatus || 'not_submitted',
      documents: user.verificationDocuments || {},
      verificationHistory: user.verificationHistory || []
    });
  } catch (error) {
    console.error('Error getting document status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resubmitDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.userType !== 'housekeeper') {
      return res.status(403).json({ message: 'Only housekeepers can resubmit documents' });
    }
    
    // Check if the user's documents were rejected
    if (user.verificationStatus !== 'rejected') {
      return res.status(400).json({ 
        message: 'Only rejected documents can be resubmitted' 
      });
    }
    
    // Change status to pending
    user.verificationStatus = 'pending';
    
    // Add to verification history
    if (!user.verificationHistory) {
      user.verificationHistory = [];
    }
    
    user.verificationHistory.push({
      status: 'pending',
      date: new Date(),
      notes: 'Documents resubmitted after rejection'
    });
    
    // Save the updated user
    await user.save();
    
    res.json({
      message: 'Documents resubmitted successfully',
      status: 'pending'
    });
  } catch (error) {
    console.error('Error resubmitting documents:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { docType, fileId } = req.params;
    
    // Validate document type
    const validDocTypes = ['identificationCard', 'certifications'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if the document type exists
    if (!user.verificationDocuments || !user.verificationDocuments[docType]) {
      return res.status(404).json({ message: 'Document type not found' });
    }
    
    // Find the specific file
    const fileIndex = user.verificationDocuments[docType].files.findIndex(
      file => file.id === fileId
    );
    
    if (fileIndex === -1) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Get the file path
    const filePath = path.join(__dirname, '..', user.verificationDocuments[docType].files[fileIndex].path);
    
    // Delete the file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove the file from the documents array
    user.verificationDocuments[docType].files.splice(fileIndex, 1);
    
    // Update verification status to pending if previous status was verified
    if (user.verificationDocuments[docType].verified) {
      user.verificationDocuments[docType].verified = false;
      
      // If overall status was approved, set it back to pending
      if (user.verificationStatus === 'approved') {
        user.verificationStatus = 'pending';
        
        // Add to verification history
        if (!user.verificationHistory) {
          user.verificationHistory = [];
        }
        
        user.verificationHistory.push({
          status: 'pending',
          date: new Date(),
          notes: 'Document deleted, verification status updated'
        });
      }
    }
    
    // Save the updated user
    await user.save();
    
    res.json({
      message: 'Document deleted successfully',
      documents: user.verificationDocuments
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitDocumentsForVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update the user's document verification status to 'pending'
    user.verificationStatus = 'pending';
    
    // Add to verification history
    if (!user.verificationHistory) {
      user.verificationHistory = [];
    }
    
    user.verificationHistory.push({
      status: 'pending',
      date: new Date(),
      notes: 'Documents submitted for verification'
    });
    
    // Save the updated user
    await user.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Documents submitted for verification successfully',
      status: 'pending',
      verificationHistory: user.verificationHistory
    });
  } catch (error) {
    console.error('Error submitting documents for verification:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to submit documents for verification' 
    });
  }
}; 