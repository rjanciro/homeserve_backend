const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Upload document for verification
router.post('/upload/:docType', auth, documentController.uploadDocument);

// Get document verification status
router.get('/status', auth, documentController.getDocumentStatus);

// Resubmit documents after rejection
router.post('/resubmit', auth, documentController.resubmitDocuments);

// Delete a specific document
router.delete('/:docType/:fileId', auth, documentController.deleteDocument);

// Add this route to handle document submission
router.post('/submit', auth, documentController.submitDocumentsForVerification);

// Add this route to your document routes
router.get('/download/:userId/:docType/:filename', (req, res) => {
  const { userId, docType, filename } = req.params;
  
  // Log the request details
  console.log(`Download request for userId: ${userId}, docType: ${docType}, filename: ${filename}`);
  
  // Look for a matching file in the verification directory
  const verificationDir = path.join(__dirname, '../uploads/verification');
  const files = fs.readdirSync(verificationDir);
  
  // Look for files that start with the userId and docType
  const matchingFiles = files.filter(file => 
    file.startsWith(`${userId}_${docType}_`) || 
    file.includes(filename));
  
  console.log('Matching files:', matchingFiles);
  
  if (matchingFiles.length > 0) {
    // Use the first matching file
    const filePath = path.join(verificationDir, matchingFiles[0]);
    res.sendFile(filePath);
  } else {
    // If no matching file found, return 404
    res.status(404).send('File not found');
  }
});

// Add this route for direct file lookup by userId
router.get('/file/:userId', (req, res) => {
  const { userId } = req.params;
  
  // Find any file for this user
  const verificationDir = path.join(__dirname, '../uploads/verification');
  const files = fs.readdirSync(verificationDir);
  
  // Find files that start with the userId
  const userFiles = files.filter(file => file.startsWith(`${userId}_`));
  
  if (userFiles.length > 0) {
    // Just return the first file for this user
    const filePath = path.join(verificationDir, userFiles[0]);
    res.sendFile(filePath);
  } else {
    res.status(404).send('No files found for this user');
  }
});

// Add this diagnostic route to help with debugging
router.get('/debug/:userId', (req, res) => {
  const { userId } = req.params;
  const verificationDir = path.join(__dirname, '../uploads/verification');
  
  try {
    // Get all files in the verification directory
    const allFiles = fs.readdirSync(verificationDir);
    
    // Filter to just this user's files
    const userFiles = allFiles.filter(file => file.startsWith(`${userId}_`));
    
    // Return detailed information about each file
    const fileDetails = userFiles.map(filename => {
      const filePath = path.join(verificationDir, filename);
      const stats = fs.statSync(filePath);
      
      // Parse the filename to extract docType
      const parts = filename.split('_');
      const docType = parts.length > 1 ? parts[1] : 'unknown';
      
      return {
        filename,
        size: stats.size,
        created: stats.birthtime,
        docType,
        fullPath: filePath,
        accessUrl: `/uploads/verification/${filename}`
      };
    });
    
    res.json({
      userId,
      filesFound: userFiles.length,
      files: fileDetails
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this route to correctly show document uploads
router.get('/show/:userId/:docType/:filename', (req, res) => {
  const { userId, docType, filename } = req.params;
  
  // First try to find the exact file if it exists
  const verificationDir = path.join(__dirname, '../uploads/verification');
  const exactPath = path.join(verificationDir, filename);
  
  if (fs.existsSync(exactPath)) {
    return res.sendFile(exactPath);
  }
  
  // If exact file doesn't exist, look for user's files matching the pattern
  const files = fs.readdirSync(verificationDir);
  
  // First, try to find by userId and docType
  const matchingFiles = files.filter(file => 
    file.startsWith(`${userId}_${docType}_`)
  );
  
  if (matchingFiles.length > 0) {
    // Find the newest file (highest creation time)
    let newestFile = matchingFiles[0];
    let newestTime = fs.statSync(path.join(verificationDir, newestFile)).birthtimeMs;
    
    for (let i = 1; i < matchingFiles.length; i++) {
      const filePath = path.join(verificationDir, matchingFiles[i]);
      const fileTime = fs.statSync(filePath).birthtimeMs;
      
      if (fileTime > newestTime) {
        newestTime = fileTime;
        newestFile = matchingFiles[i];
      }
    }
    
    return res.sendFile(path.join(verificationDir, newestFile));
  }
  
  // If all else fails, try to find any file for this user
  const userFiles = files.filter(file => file.startsWith(`${userId}_`));
  
  if (userFiles.length > 0) {
    return res.sendFile(path.join(verificationDir, userFiles[0]));
  }
  
  // If no file found
  res.status(404).send('No matching file found');
});

module.exports = router; 