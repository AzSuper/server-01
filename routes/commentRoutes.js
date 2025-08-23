const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const CommentController = require('../controllers/commentController');

const router = express.Router();

// Public: list comments for a post
router.get('/post/:post_id', CommentController.getPostComments);

// Protected: create/delete comments
router.post('/', authenticateToken, CommentController.createComment);
router.delete('/:comment_id', authenticateToken, CommentController.deleteComment);

module.exports = router;


