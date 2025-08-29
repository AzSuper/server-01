const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const pointsController = require('../controllers/pointsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin authentication - NO MIDDLEWARE APPLIED
router.post('/login', adminController.adminLogin);

// Protected admin routes - require admin authentication
// Dashboard statistics
router.get('/dashboard/stats', authenticateToken, requireAdmin, adminController.getDashboardStats);

// User management
router.get('/users', authenticateToken, requireAdmin, adminController.getAllUsers);
router.delete('/users/:id', authenticateToken, requireAdmin, adminController.deleteUser);

// Advertiser management
router.get('/advertisers', authenticateToken, requireAdmin, adminController.getAllAdvertisers);
router.delete('/advertisers/:id', authenticateToken, requireAdmin, adminController.deleteAdvertiser);

// Post management
router.get('/posts', authenticateToken, requireAdmin, adminController.getAllPosts);
router.delete('/posts/:id', authenticateToken, requireAdmin, adminController.deletePost);

// Reservation management
router.get('/reservations', authenticateToken, requireAdmin, adminController.getAllReservations);
router.delete('/reservations/:id', authenticateToken, requireAdmin, adminController.deleteReservation);

// Category management
router.get('/categories', authenticateToken, requireAdmin, adminController.getAllCategories);
router.post('/categories', authenticateToken, requireAdmin, adminController.createCategory);
router.put('/categories/:id', authenticateToken, requireAdmin, adminController.updateCategory);
router.delete('/categories/:id', authenticateToken, requireAdmin, adminController.deleteCategory);

// Points System Management
router.get('/points', authenticateToken, requireAdmin, pointsController.getAllUserPoints);
router.get('/points/stats', authenticateToken, requireAdmin, pointsController.getPointsStats);
router.put('/points/:id/adjust', authenticateToken, requireAdmin, pointsController.adminAdjustPoints);
router.get('/points/withdrawal-requests', authenticateToken, requireAdmin, pointsController.getWithdrawalRequests);
router.post('/points/withdrawal-requests/:id/approve', authenticateToken, requireAdmin, pointsController.approveWithdrawal);
router.post('/points/withdrawal-requests/:id/reject', authenticateToken, requireAdmin, pointsController.rejectWithdrawal);

// Public points endpoints (for users)
router.post('/points/request', pointsController.requestPoints);
router.get('/points/user/:userId/:userType', pointsController.getUserPoints);

module.exports = router;
