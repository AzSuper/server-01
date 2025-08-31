const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// User endpoints (require authentication)
router.post('/request', authenticateToken, pointsController.requestPointsFromAdmin); // FIXED: Now properly requests points from admin
router.get('/my-requests', authenticateToken, pointsController.getMyPointRequests); // NEW: Get user's own requests
router.get('/request/:requestId', authenticateToken, pointsController.getPointRequestDetails); // NEW: Get request details
router.get('/user/:userId/:userType', authenticateToken, pointsController.getUserPoints); // Get user points (authenticated)

// Withdrawal endpoints (for users to withdraw their own points)
router.post('/withdrawal', authenticateToken, pointsController.requestPoints); // This is actually for withdrawals
router.get('/withdrawal/my-requests', authenticateToken, pointsController.getMyPointRequests); // Get withdrawal requests

// Admin endpoints (require admin authentication)
router.get('/admin/all', authenticateToken, requireAdmin, pointsController.getAllUserPoints);
router.get('/admin/stats', authenticateToken, requireAdmin, pointsController.getPointsStats);
router.put('/admin/:id/adjust', authenticateToken, requireAdmin, pointsController.adminAdjustPoints);

// Admin point request management (NEW - the missing bridge)
router.get('/admin/requests', authenticateToken, requireAdmin, pointsController.getAllPointRequests);
router.get('/admin/requests/stats', authenticateToken, requireAdmin, pointsController.getPointRequestStats);
router.put('/admin/requests/:requestId/process', authenticateToken, requireAdmin, pointsController.processPointRequest);

// Admin withdrawal management
router.get('/admin/withdrawal-requests', authenticateToken, requireAdmin, pointsController.getWithdrawalRequests);
router.post('/admin/withdrawal-requests/:id/approve', authenticateToken, requireAdmin, pointsController.approveWithdrawal);
router.post('/admin/withdrawal-requests/:id/reject', authenticateToken, requireAdmin, pointsController.rejectWithdrawal);

module.exports = router;
