const express = require('express');
const postController = require('../controllers/postController');
const { authenticateToken, requireAdvertiser, requireSelfOrAdmin } = require('../middleware/auth');
const { singleFile } = require('../middleware/upload');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', postController.getPosts);
// Specific route must come before generic '/:id'
router.get('/advertiser/:advertiser_id', authenticateToken, requireSelfOrAdmin('advertiser_id'), postController.getPostsByAdvertiser);
router.get('/:id/engagement', postController.getPostEngagement);
router.get('/:id', postController.getPostDetails);

// Admin routes for dashboard
router.get('/admin/all', postController.getAllPostsAdmin);
router.get('/admin/stats', postController.getPostStats);

// Protected routes (authentication required)
// Only advertisers can create reels
// Support both 'media' and 'video' field names for backward compatibility
router.post('/', authenticateToken, requireAdvertiser, singleFile, postController.createPost);
router.post('/save', authenticateToken, postController.savePost);
router.get('/saved/:client_id', authenticateToken, requireSelfOrAdmin('client_id'), postController.getSavedPosts);

// Likes functionality
router.post('/:post_id/like', authenticateToken, postController.toggleLike);
router.get('/:post_id/like-status', authenticateToken, postController.checkLikeStatus);
router.get('/liked/:user_id', authenticateToken, requireSelfOrAdmin('user_id'), postController.getLikedPosts);

module.exports = router;