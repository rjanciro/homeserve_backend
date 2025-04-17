const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/admin.verification.controller');
const adminAuth = require('../middleware/adminAuth');

router.get('/pending-housekeepers', adminAuth, verificationController.getPendingHousekeepers);
router.get('/housekeepers', adminAuth, verificationController.getAllHousekeepers);
router.post('/verify-housekeeper', adminAuth, verificationController.verifyHousekeeper);
router.get('/housekeeper-documents/:userId', adminAuth, verificationController.getHousekeeperDocuments);
router.put('/housekeeper-status/:housekeeperId', adminAuth, verificationController.updateHousekeeperStatus);

module.exports = router; 