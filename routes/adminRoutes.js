const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin authentication
router.post('/login', adminController.adminLogin);

// Protected admin routes - require admin authentication
router.use(authenticateToken, requireAdmin);

// Dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.delete('/users/:id', adminController.deleteUser);

// Advertiser management
router.get('/advertisers', adminController.getAllAdvertisers);
router.delete('/advertisers/:id', adminController.deleteAdvertiser);

// Post management
router.get('/posts', adminController.getAllPosts);
router.delete('/posts/:id', adminController.deletePost);

// Reservation management
router.get('/reservations', adminController.getAllReservations);
router.delete('/reservations/:id', adminController.deleteReservation);

// Category management
router.get('/categories', adminController.getAllCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

module.exports = router;
