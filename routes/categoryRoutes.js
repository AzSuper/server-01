const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public route - no authentication required
router.get('/', categoryController.getAllCategories);

module.exports = router;
