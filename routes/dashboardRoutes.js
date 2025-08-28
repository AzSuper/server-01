const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const reservationController = require('../controllers/reservationController');
const CommentController = require('../controllers/commentController');

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

        res.json({
            status: 'success',
            message: 'Dashboard statistics retrieved successfully',
            data: {
                users: userStats.rows[0],
                posts: postStats.rows[0],
                reservations: reservationStats.rows[0],
                comments: commentStats.rows[0],
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
router.get('/users', authenticateToken, userController.getAllUsers);
router.get('/users/advertisers', authenticateToken, userController.getAllAdvertisers);
router.get('/users/combined', authenticateToken, userController.getAllUsersCombined);
router.put('/users/:id/verification', authenticateToken, userController.updateUserVerificationStatus);
router.delete('/users/:id', authenticateToken, userController.deleteUser);

// Post management endpoints (admin)
router.get('/posts', authenticateToken, postController.getAllPostsAdmin);
router.get('/posts/stats', authenticateToken, postController.getPostStats);

// Reservation management endpoints (admin)
router.get('/reservations', authenticateToken, reservationController.getAllReservationsAdmin);
router.get('/reservations/stats', authenticateToken, reservationController.getReservationStats);

// Comment management endpoints (admin)
router.get('/comments', authenticateToken, CommentController.getAllCommentsAdmin);
router.get('/comments/stats', authenticateToken, CommentController.getCommentStats);

module.exports = router;
