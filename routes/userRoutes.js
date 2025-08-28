const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

// Step 1: Send OTP (user enters all data first)
router.post('/send-otp', userController.sendOTP);

// Step 2: Verify OTP and create account (all in one step)
router.post('/verify-otp', userController.verifyOTP);

// Login
router.post('/login', userController.login);

// Password Reset Routes
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Protected Routes (require authentication)
router.get('/profile', authenticateToken, userController.getUserProfile);
router.put('/profile', authenticateToken, userController.updateUserProfile);

// Admin Routes
router.get('/:id', authenticateToken, userController.getUserById);

// New Admin Routes for User Management
router.get('/admin/users', authenticateToken, userController.getAllUsers);
router.get('/admin/advertisers', authenticateToken, userController.getAllAdvertisers);
router.get('/admin/users/combined', authenticateToken, userController.getAllUsersCombined);
router.put('/admin/users/:id/verification', authenticateToken, userController.updateUserVerificationStatus);
router.delete('/admin/users/:id', authenticateToken, userController.deleteUser);

// Utility Routes
router.post('/cleanup-otps', userController.cleanupOTPs);

// Get latest OTP for testing (development only)
router.get('/otp/:phone/:type/:userType', userController.getLatestOTP);

module.exports = router;
