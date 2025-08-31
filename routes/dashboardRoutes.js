const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const reservationController = require('../controllers/reservationController');
const CommentController = require('../controllers/commentController');
const pointsController = require('../controllers/pointsController');

// Dashboard overview statistics (public)
router.get('/stats', async (req, res) => {
    try {
        const { pool } = require('../config/db');
        
        // Get user statistics
        const userStats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE is_verified = true) as verified_users,
                (SELECT COUNT(*) FROM advertisers) as total_advertisers,
                (SELECT COUNT(*) FROM advertisers WHERE is_verified = true) as verified_advertisers
        `);

        // Get post statistics
        const postStats = await pool.query(`
            SELECT 
                COUNT(*) as total_posts,
                COUNT(CASE WHEN type = 'reel' THEN 1 END) as total_reels,
                COUNT(CASE WHEN type = 'post' THEN 1 END) as total_product_posts,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as posts_last_7_days
        `);

        // Get reservation statistics
        const reservationStats = await pool.query(`
            SELECT 
                COUNT(*) as total_reservations,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_reservations,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations
        `);

        // Get comment statistics
        const commentStats = await pool.query(`
            SELECT 
                COUNT(*) as total_comments,
                COUNT(CASE WHEN status = 'visible' THEN 1 END) as visible_comments,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as comments_last_7_days
        `);

        // Get point request statistics (NEW)
        const pointRequestStats = await pool.query(`
            SELECT 
                COUNT(*) as total_point_requests,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_point_requests,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_point_requests
            FROM point_requests
        `);

        res.json({
            status: 'success',
            message: 'Dashboard statistics retrieved successfully',
            data: {
                users: userStats.rows[0],
                posts: postStats.rows[0],
                reservations: reservationStats.rows[0],
                comments: commentStats.rows[0],
                pointRequests: pointRequestStats.rows[0], // NEW
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve dashboard statistics'
        });
    }
});

// User management endpoints (admin)
router.get('/users', authenticateToken, requireAdmin, userController.getAllUsers);
router.get('/users/advertisers', authenticateToken, requireAdmin, userController.getAllAdvertisers);
router.get('/users/combined', authenticateToken, requireAdmin, userController.getAllUsersCombined);
router.put('/users/:id/verification', authenticateToken, requireAdmin, userController.updateUserVerificationStatus);
router.delete('/users/:id', authenticateToken, requireAdmin, userController.deleteUser);

// Post management endpoints (admin)
router.get('/posts', authenticateToken, requireAdmin, postController.getAllPostsAdmin);
router.get('/posts/stats', authenticateToken, requireAdmin, postController.getPostStats);

// Reservation management endpoints (admin)
router.get('/reservations', authenticateToken, requireAdmin, reservationController.getAllReservationsAdmin);
router.get('/reservations/stats', authenticateToken, requireAdmin, reservationController.getReservationStats);

// Comment management endpoints (admin)
router.get('/comments', authenticateToken, requireAdmin, CommentController.getAllCommentsAdmin);
router.get('/comments/stats', authenticateToken, requireAdmin, CommentController.getCommentStats);

// Point management endpoints (admin) - NEW
router.get('/points', authenticateToken, requireAdmin, pointsController.getAllUserPoints);
router.get('/points/stats', authenticateToken, requireAdmin, pointsController.getPointsStats);
router.put('/points/:id/adjust', authenticateToken, requireAdmin, pointsController.adminAdjustPoints);

// Point request management endpoints (admin) - NEW - THE MISSING BRIDGE
router.get('/points/requests', authenticateToken, requireAdmin, pointsController.getAllPointRequests);
router.get('/points/requests/stats', authenticateToken, requireAdmin, pointsController.getPointRequestStats);
router.put('/points/requests/:requestId/process', authenticateToken, requireAdmin, pointsController.processPointRequest);

// Withdrawal management endpoints (admin)
router.get('/points/withdrawals', authenticateToken, requireAdmin, pointsController.getWithdrawalRequests);
router.post('/points/withdrawals/:id/approve', authenticateToken, requireAdmin, pointsController.approveWithdrawal);
router.post('/points/withdrawals/:id/reject', authenticateToken, requireAdmin, pointsController.rejectWithdrawal);

module.exports = router;
