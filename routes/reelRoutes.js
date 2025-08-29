const express = require('express');
const multer = require('multer');
const reelController = require('../controllers/reelController');
const { authenticateToken, requireAdvertiser } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Public routes (no authentication required)
router.get('/', reelController.getReels);
router.get('/:id', reelController.getReelById);

// Protected routes (authentication required)
// Only advertisers can create reels
router.post('/', authenticateToken, requireAdvertiser, upload.any(), reelController.createReel);

// User interaction routes (authentication required)
router.post('/:id/like', authenticateToken, reelController.toggleReelLike);
router.get('/:id/like-status', authenticateToken, reelController.getReelLikeStatus);

module.exports = router;
