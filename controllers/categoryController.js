const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

// Get all categories (public - no authentication required)
exports.getAllCategories = async (req, res) => {
    try {
        const query = 'SELECT * FROM categories ORDER BY name';
        const result = await pool.query(query);

        res.json({
            message: 'Categories retrieved successfully',
            data: result.rows
        });

    } catch (error) {
        logger.error('Get all categories error:', error);
        res.status(500).json({ error: 'Failed to retrieve categories' });
    }
};
