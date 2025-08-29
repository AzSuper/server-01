const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public endpoints (for users to request points)
router.post('/request', pointsController.requestPoints);
router.get('/user/:userId/:userType', pointsController.getUserPoints);

// Admin endpoints (require admin authentication)
router.get('/admin/all', authenticateToken, requireAdmin, pointsController.getAllUserPoints);
router.get('/admin/stats', authenticateToken, requireAdmin, pointsController.getPointsStats);
router.put('/admin/:id/adjust', authenticateToken, requireAdmin, pointsController.adminAdjustPoints);
router.get('/admin/withdrawal-requests', authenticateToken, requireAdmin, pointsController.getWithdrawalRequests);
router.post('/admin/withdrawal-requests/:id/approve', authenticateToken, requireAdmin, pointsController.approveWithdrawal);
router.post('/admin/withdrawal-requests/:id/reject', authenticateToken, requireAdmin, pointsController.rejectWithdrawal);

module.exports = router;
