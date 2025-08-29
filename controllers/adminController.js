const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

// Admin login with constant token
exports.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        // Query admin from database
        const query = 'SELECT * FROM admins WHERE username = $1 AND is_active = true';
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        const admin = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Generate admin token (never expires)
        const adminToken = jwt.sign(
            {
                id: admin.id,
                username: admin.username,
                type: 'admin',
                permissions: admin.permissions
            },
            process.env.JWT_SECRET,
            { expiresIn: '100y' } // 100 years - effectively never expires
        );

        res.json({
            message: 'Admin login successful',
            token: adminToken,
            admin: {
                id: admin.id,
                username: admin.username,
                full_name: admin.full_name,
                email: admin.email,
                permissions: admin.permissions
            }
        });

    } catch (error) {
        logger.error('Admin login error:', error);
        res.status(500).json({ error: 'Admin login failed' });
    }
};

// Get all users (paginated)
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM users';
        const countResult = await pool.query(countQuery);
        const totalUsers = parseInt(countResult.rows[0].count);

        // Get users with pagination
        const query = `
            SELECT id, full_name, phone, profile_image, is_verified, created_at, updated_at
            FROM users 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        res.json({
            message: 'Users retrieved successfully',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalUsers,
                pages: Math.ceil(totalUsers / limit)
            }
        });

    } catch (error) {
        logger.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
};

// Get all advertisers (paginated)
exports.getAllAdvertisers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM advertisers';
        const countResult = await pool.query(countQuery);
        const totalAdvertisers = parseInt(countResult.rows[0].count);

        // Get advertisers with pagination
        const query = `
            SELECT id, full_name, phone, store_name, store_image, description, is_verified, created_at, updated_at
            FROM advertisers 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        res.json({
            message: 'Advertisers retrieved successfully',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalAdvertisers,
                pages: Math.ceil(totalAdvertisers / limit)
            }
        });

    } catch (error) {
        logger.error('Get all advertisers error:', error);
        res.status(500).json({ error: 'Failed to retrieve advertisers' });
    }
};

// Get all posts (paginated)
exports.getAllPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM posts';
        const countResult = await pool.query(countQuery);
        const totalPosts = parseInt(countResult.rows[0].count);

        // Get posts with advertiser and category details
        const query = `
            SELECT p.*, 
                   a.full_name as advertiser_name, 
                   a.store_name,
                   c.name as category_name
            FROM posts p
            LEFT JOIN advertisers a ON p.advertiser_id = a.id
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        res.json({
            message: 'Posts retrieved successfully',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalPosts,
                pages: Math.ceil(totalPosts / limit)
            }
        });

    } catch (error) {
        logger.error('Get all posts error:', error);
        res.status(500).json({ error: 'Failed to retrieve posts' });
    }
};

// Get all reservations (paginated)
exports.getAllReservations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM reservations';
        const countResult = await pool.query(countQuery);
        const totalReservations = parseInt(countResult.rows[0].count);

        // Get reservations with post and client details
        const query = `
            SELECT r.*, 
                   p.title as post_title,
                   p.type as post_type,
                   CASE 
                       WHEN r.client_type = 'user' THEN u.full_name
                       WHEN r.client_type = 'advertiser' THEN a.full_name
                   END as client_name
            FROM reservations r
            LEFT JOIN posts p ON r.post_id = p.id
            LEFT JOIN users u ON r.client_id = u.id AND r.client_type = 'user'
            LEFT JOIN advertisers a ON r.client_id = a.id AND r.client_type = 'advertiser'
            ORDER BY r.reserved_at DESC 
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        res.json({
            message: 'Reservations retrieved successfully',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalReservations,
                pages: Math.ceil(totalReservations / limit)
            }
        });

    } catch (error) {
        logger.error('Get all reservations error:', error);
        res.status(500).json({ error: 'Failed to retrieve reservations' });
    }
};

// Get all categories
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

// Hard delete user
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const checkQuery = 'SELECT id FROM users WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Hard delete user
        const deleteQuery = 'DELETE FROM users WHERE id = $1';
        await pool.query(deleteQuery, [id]);

        res.json({
            message: 'User deleted successfully'
        });

    } catch (error) {
        logger.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

// Hard delete advertiser
exports.deleteAdvertiser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if advertiser exists
        const checkQuery = 'SELECT id FROM advertisers WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Advertiser not found'
            });
        }

        // Hard delete advertiser (posts will be cascade deleted)
        const deleteQuery = 'DELETE FROM advertisers WHERE id = $1';
        await pool.query(deleteQuery, [id]);

        res.json({
            message: 'Advertiser deleted successfully'
        });

    } catch (error) {
        logger.error('Delete advertiser error:', error);
        res.status(500).json({ error: 'Failed to delete advertiser' });
    }
};

// Hard delete post
exports.deletePost = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if post exists
        const checkQuery = 'SELECT id FROM posts WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Post not found'
            });
        }

        // Hard delete post (reservations will be cascade deleted)
        const deleteQuery = 'DELETE FROM posts WHERE id = $1';
        await pool.query(deleteQuery, [id]);

        res.json({
            message: 'Post deleted successfully'
        });

    } catch (error) {
        logger.error('Delete post error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
};

// Hard delete reservation
exports.deleteReservation = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if reservation exists
        const checkQuery = 'SELECT id FROM reservations WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Reservation not found'
            });
        }

        // Hard delete reservation
        const deleteQuery = 'DELETE FROM reservations WHERE id = $1';
        await pool.query(deleteQuery, [id]);

        res.json({
            message: 'Reservation deleted successfully'
        });

    } catch (error) {
        logger.error('Delete reservation error:', error);
        res.status(500).json({ error: 'Failed to delete reservation' });
    }
};

// Hard delete category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category exists
        const checkQuery = 'SELECT id FROM categories WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        // Check if category is being used by posts
        const usageQuery = 'SELECT COUNT(*) FROM posts WHERE category_id = $1';
        const usageResult = await pool.query(usageQuery, [id]);
        const usageCount = parseInt(usageResult.rows[0].count);

        if (usageCount > 0) {
            return res.status(400).json({
                error: `Cannot delete category. It is being used by ${usageCount} post(s).`
            });
        }

        // Hard delete category
        const deleteQuery = 'DELETE FROM categories WHERE id = $1';
        await pool.query(deleteQuery, [id]);

        res.json({
            message: 'Category deleted successfully'
        });

    } catch (error) {
        logger.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
};

// Create new category
exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        // Check if category already exists
        const checkQuery = 'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)';
        const checkResult = await pool.query(checkQuery, [name.trim()]);

        if (checkResult.rows.length > 0) {
            return res.status(409).json({
                error: 'Category with this name already exists'
            });
        }

        // Create new category
        const insertQuery = 'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *';
        const result = await pool.query(insertQuery, [name.trim(), description]);

        res.status(201).json({
            message: 'Category created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        logger.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        // Check if category exists
        const checkQuery = 'SELECT id FROM categories WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        // Check if new name conflicts with existing category
        const conflictQuery = 'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2';
        const conflictResult = await pool.query(conflictQuery, [name.trim(), id]);

        if (conflictResult.rows.length > 0) {
            return res.status(409).json({
                error: 'Category with this name already exists'
            });
        }

        // Update category
        const updateQuery = 'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *';
        const result = await pool.query(updateQuery, [name.trim(), description, id]);

        res.json({
            message: 'Category updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        logger.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        // Get basic counts
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const advertisersCount = await pool.query('SELECT COUNT(*) FROM advertisers');
        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        const reservationsCount = await pool.query('SELECT COUNT(*) FROM reservations');
        const commentsCount = await pool.query('SELECT COUNT(*) FROM comments');
        const categoriesCount = await pool.query('SELECT COUNT(*) FROM categories');

        // Get points system stats
        const pointsStats = await pool.query(`
            SELECT 
                COUNT(*) as total_users_with_points,
                SUM(points_balance) as total_points_in_circulation,
                COUNT(CASE WHEN points_balance > 0 THEN 1 END) as active_users
            FROM user_points
        `);

        // Get pending withdrawal requests
        const withdrawalRequests = await pool.query(`
            SELECT COUNT(*) as pending_withdrawals
            FROM point_withdrawals 
            WHERE status = 'pending'
        `);

        // Get monthly stats
        const currentMonth = new Date();
        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        
        const newUsersThisMonth = await pool.query(
            'SELECT COUNT(*) FROM users WHERE created_at >= $1',
            [firstDayOfMonth]
        );
        
        const postsThisMonth = await pool.query(
            'SELECT COUNT(*) FROM posts WHERE created_at >= $1',
            [firstDayOfMonth]
        );
        
        const reservationsThisMonth = await pool.query(
            'SELECT COUNT(*) FROM reservations WHERE reserved_at >= $1',
            [firstDayOfMonth]
        );

        // Get recent activity
        const recentPosts = await pool.query(`
            SELECT p.title, p.created_at, a.full_name as advertiser_name
            FROM posts p
            JOIN advertisers a ON p.advertiser_id = a.id
            ORDER BY p.created_at DESC
            LIMIT 5
        `);

        const recentReservations = await pool.query(`
            SELECT 
                r.reserved_at,
                p.title as post_title,
                CASE 
                    WHEN r.client_type = 'user' THEN u.full_name
                    WHEN r.client_type = 'advertiser' THEN a.full_name
                END as client_name
            FROM reservations r
            JOIN posts p ON r.post_id = p.id
            LEFT JOIN users u ON r.client_id = u.id AND r.client_type = 'user'
            LEFT JOIN advertisers a ON r.client_id = a.id AND r.client_type = 'advertiser'
            ORDER BY r.reserved_at DESC
            LIMIT 5
        `);

        res.json({
            message: 'Dashboard statistics retrieved successfully',
            data: {
                totalUsers: parseInt(usersCount.rows[0].count),
                totalAdvertisers: parseInt(advertisersCount.rows[0].count),
                totalPosts: parseInt(postsCount.rows[0].count),
                totalReservations: parseInt(reservationsCount.rows[0].count),
                totalComments: parseInt(commentsCount.rows[0].count),
                totalCategories: parseInt(categoriesCount.rows[0].count),
                activeUsers: parseInt(pointsStats.rows[0].active_users || 0),
                newUsersThisMonth: parseInt(newUsersThisMonth.rows[0].count),
                postsThisMonth: parseInt(postsThisMonth.rows[0].count),
                reservationsThisMonth: parseInt(reservationsThisMonth.rows[0].count),
                pointsSystem: {
                    totalUsersWithPoints: parseInt(pointsStats.rows[0].total_users_with_points || 0),
                    totalPointsInCirculation: parseInt(pointsStats.rows[0].total_points_in_circulation || 0),
                    pendingWithdrawals: parseInt(withdrawalRequests.rows[0].pending_withdrawals || 0)
                },
                recentActivity: {
                    posts: recentPosts.rows,
                    reservations: recentReservations.rows
                }
            }
        });

    } catch (error) {
        logger.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
    }
};
