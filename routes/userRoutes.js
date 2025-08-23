const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

// OTP and Authentication Routes
router.post('/send-otp', userController.sendOTP);
router.post('/register/normal-user', userController.verifyOTPAndRegisterNormalUser);
router.post('/register/advertiser', userController.verifyOTPAndRegisterAdvertiser);
router.post('/login', userController.loginUser);

// Password Reset Routes
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Protected Routes (require authentication)
router.get('/profile', authenticateToken, userController.getUserProfile);
router.put('/advertiser/profile', authenticateToken, userController.updateAdvertiserProfile);

// Admin Routes
router.get('/:id', authenticateToken, userController.getUserById);

// Utility Routes
router.post('/cleanup-otps', userController.cleanupOTPs);

// Get latest OTP for testing (development only)
router.get('/otp/:phone/:type', userController.getLatestOTP);

module.exports = router;
