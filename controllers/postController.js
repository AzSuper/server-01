const { pool } = require('../config/db');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { logger } = require('../utils/logger');

// Get post engagement (comments/saves/reservations counts)
exports.getPostEngagement = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM v_post_engagement WHERE post_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error retrieving post engagement:', error);
        res.status(500).json({ error: 'Failed to retrieve post engagement' });
    }
};

// Create a new post
exports.createPost = async (req, res) => {
    const { 
        description 
    } = req.body;
    
    // For reels, automatically set type and extract advertiser_id from token
    const type = 'reel';
    const advertiser_id = req.user.id;
    
    // Debug logging for request
    logger.info('=== Request Debug Info ===');
    logger.info('Request body:', req.body);
    logger.info('Request files:', req.files);
    logger.info('Request file:', req.file);
    logger.info('Content-Type:', req.get('Content-Type'));
    logger.info('=== End Request Debug ===');

    try {

        // Validation passed

        // Check if a file was uploaded (support both 'media' and 'video' field names for backward compatibility)
        let uploadedFile = null;
        
        // Check for files in req.files (from upload.any)
        if (req.files && req.files.length > 0) {
            uploadedFile = req.files[0];
            logger.info(`File found in req.files: ${uploadedFile.originalname}, fieldname: ${uploadedFile.fieldname}`);
        }
        
        // Fallback to req.file (from upload.single)
        if (!uploadedFile && req.file) {
            uploadedFile = req.file;
            logger.info(`File found in req.file: ${uploadedFile.originalname}`);
        }
        
        if (!uploadedFile) {
            logger.error('No file uploaded in request');
            logger.error('req.files:', req.files);
            logger.error('req.file:', req.file);
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        logger.info(`File uploaded: ${uploadedFile.originalname}, size: ${uploadedFile.size}, path: ${uploadedFile.path}`);
        
        // Debug logging for file upload
        logger.info('=== File Upload Debug Info ===');
        logger.info('req.files:', JSON.stringify(req.files, null, 2));
        logger.info('req.file:', JSON.stringify(req.file, null, 2));
        logger.info('uploadedFile:', JSON.stringify(uploadedFile, null, 2));
        logger.info('=== End Debug Info ===');

                // Validate required fields for reels
        if (!description) {
            return res.status(400).json({ 
                error: 'Description is required for reel posts' 
            });
        }

        // Validate user is an advertiser
        const caller = req.user;
        if (!caller) {
            logger.error('Unauthorized access attempt - no user in request');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (caller.type !== 'advertiser') {
            logger.error(`Forbidden: User ${caller.id} (type: ${caller.type}) trying to create reel`);
            return res.status(403).json({ error: 'Forbidden: only advertisers can create reels' });
        }
        
        logger.info(`Authorization passed for advertiser ${caller.id} creating reel`);

        // Upload media to Cloudinary
        logger.info(`Starting Cloudinary upload for file: ${uploadedFile.path}`);
        
        // Validate Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            logger.error('Cloudinary configuration missing');
            return res.status(500).json({ error: 'Media upload service not configured' });
        }
        
        const mediaUpload = await cloudinary.uploader.upload(uploadedFile.path, {
            resource_type: 'auto', // Automatically determine resource type (image/video)
        });
        logger.info(`Cloudinary upload successful: ${mediaUpload.secure_url}`);



        // Create the reel in the database
        logger.info(`Creating reel in database with advertiser_id: ${advertiser_id}, type: ${type}`);
        
        let result;
        try {
            result = await pool.query(
                'INSERT INTO posts (advertiser_id, type, description, media_url) VALUES ($1, $2, $3, $4) RETURNING *',
                [advertiser_id, type, description, mediaUpload.secure_url]
            );
            logger.info(`Reel created in database with ID: ${result.rows[0].id}`);
        } catch (dbError) {
            logger.error(`Database error creating reel: ${dbError.message}`);
            logger.error(`SQL State: ${dbError.code}, Detail: ${dbError.detail}`);
            throw new Error(`Database operation failed: ${dbError.message}`);
        }

        // Clean up temporary file
        fs.unlink(uploadedFile.path, (err) => {
            if (err) {
                console.error('Error deleting temporary file:', err);
            }
        });

        // Get the complete reel with advertiser info
        logger.info(`Fetching complete reel details for ID: ${result.rows[0].id}`);
        const completeReelResult = await pool.query(`
            SELECT 
                p.*,
                u.full_name as advertiser_name
            FROM posts p
            JOIN users u ON p.advertiser_id = u.id
            WHERE p.id = $1
        `, [result.rows[0].id]);
        logger.info(`Complete reel details fetched successfully`);

        res.status(201).json({
            message: 'Reel created successfully',
            reel: completeReelResult.rows[0]
        });
    } catch (error) {
        console.error('Error creating reel:', error);
        logger.error(`Reel creation failed: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
        res.status(500).json({ 
            error: 'Reel creation failed',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get all posts with optional filtering
exports.getPosts = async (req, res) => {
    const { category_id, type, with_reservation, page = 1, limit = 10 } = req.query;
    
    try {
        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        // Build dynamic WHERE clause
        if (category_id) {
            paramCount++;
            whereConditions.push(`p.category_id = $${paramCount}`);
            queryParams.push(category_id);
        }

        if (type) {
            paramCount++;
            whereConditions.push(`p.type = $${paramCount}`);
            queryParams.push(type);
        }

        if (with_reservation !== undefined) {
            paramCount++;
            whereConditions.push(`p.with_reservation = $${paramCount}`);
            queryParams.push(with_reservation === 'true');
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Calculate pagination
        const offset = (page - 1) * limit;
        paramCount++;
        const limitParam = paramCount;
        paramCount++;
        const offsetParam = paramCount;
        queryParams.push(parseInt(limit), offset);

        // Get posts with pagination
        const postsResult = await pool.query(`
            SELECT 
                p.*,
                c.name as category_name,
                u.full_name as advertiser_name,
                COUNT(CASE WHEN r.status = 'active' THEN 1 END) as reservation_count
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            LEFT JOIN reservations r ON p.id = r.post_id AND r.status = 'active'
            ${whereClause}
            GROUP BY p.id, c.name, u.full_name
            ORDER BY p.created_at DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `, queryParams);

        // Get total count for pagination
        const countResult = await pool.query(`
            SELECT COUNT(DISTINCT p.id) as total
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            ${whereClause}
        `, queryParams.slice(0, -2)); // Remove limit and offset params

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            posts: postsResult.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_posts: total,
                posts_per_page: parseInt(limit),
                has_next_page: parseInt(page) < totalPages,
                has_prev_page: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error retrieving posts:', error);
        res.status(500).json({ error: 'Failed to retrieve posts' });
    }
};

// Get post details with reservation info
exports.getPostDetails = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                c.name as category_name,
                u.full_name as advertiser_name,
                u.email as advertiser_email,
                COUNT(CASE WHEN r.status = 'active' THEN 1 END) as reservation_count
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            LEFT JOIN reservations r ON p.id = r.post_id AND r.status = 'active'
            WHERE p.id = $1
            GROUP BY p.id, c.name, u.full_name, u.email
        `, [id]);

        if (result.rows.length > 0) {
            const post = result.rows[0];
            
            // Add availability info if post accepts reservations
            if (post.with_reservation) {
                const availableSlots = post.reservation_limit ? 
                    post.reservation_limit - parseInt(post.reservation_count) : null;
                
                post.availability = {
                    accepts_reservations: true,
                    current_reservations: parseInt(post.reservation_count),
                    available_slots: availableSlots,
                    is_available: !post.reservation_limit || availableSlots > 0,
                    is_expired: post.reservation_time ? 
                        new Date() > new Date(post.reservation_time) : false
                };
            } else {
                post.availability = {
                    accepts_reservations: false
                };
            }

            res.json(post);
        } else {
            res.status(404).json({ error: 'Post not found' });
        }
    } catch (error) {
        console.error('Error retrieving post details:', error);
        res.status(500).json({ error: 'Failed to retrieve post details' });
    }
};

// Get posts by advertiser
exports.getPostsByAdvertiser = async (req, res) => {
    const { advertiser_id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    try {
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT 
                p.*,
                c.name as category_name,
                COUNT(r.id) as reservation_count
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN reservations r ON p.id = r.post_id
            WHERE p.advertiser_id = $1
            GROUP BY p.id, c.name
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3
        `, [advertiser_id, limit, offset]);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM posts WHERE advertiser_id = $1',
            [advertiser_id]
        );

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            posts: result.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_posts: total,
                posts_per_page: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error retrieving advertiser posts:', error);
        res.status(500).json({ error: 'Failed to retrieve posts' });
    }
};

// Save a post (moved from reservation logic to separate saved posts)
exports.savePost = async (req, res) => {
    const { client_id, post_id } = req.body;

    try {
        // Check if post exists
        const postResult = await pool.query('SELECT id FROM posts WHERE id = $1', [post_id]);
        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if already saved
        const existingResult = await pool.query(
            'SELECT id FROM saved_posts WHERE client_id = $1 AND post_id = $2',
            [client_id, post_id]
        );

        if (existingResult.rows.length > 0) {
            return res.status(409).json({ error: 'Post already saved' });
        }

        // Save the post
        const result = await pool.query(
            'INSERT INTO saved_posts (client_id, post_id) VALUES ($1, $2) RETURNING *',
            [client_id, post_id]
        );

        res.status(201).json({
            message: 'Post saved successfully',
            saved_post: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving post:', error);
        res.status(500).json({ error: 'Failed to save post' });
    }
};

// Get saved posts for a client
exports.getSavedPosts = async (req, res) => {
    const { client_id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    try {
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT 
                sp.*,
                p.title,
                p.description,
                p.price,
                p.media_url,
                p.type,
                p.likes_count,
                c.name as category_name,
                u.full_name as advertiser_name
            FROM saved_posts sp
            JOIN posts p ON sp.post_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            WHERE sp.client_id = $1
            ORDER BY sp.saved_at DESC
            LIMIT $2 OFFSET $3
        `, [client_id, limit, offset]);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM saved_posts WHERE client_id = $1',
            [client_id]
        );

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            saved_posts: result.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_saved: total,
                posts_per_page: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error retrieving saved posts:', error);
        res.status(500).json({ error: 'Failed to retrieve saved posts' });
    }
};

// Toggle like on a post
exports.toggleLike = async (req, res) => {
    const { post_id } = req.params;
    const user_id = req.user.id;

    try {
        // Check if post exists
        const postResult = await pool.query('SELECT id FROM posts WHERE id = $1', [post_id]);
        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Use the database function to toggle like
        const result = await pool.query(
            'SELECT * FROM toggle_post_like($1, $2)',
            [user_id, post_id]
        );

        const likeData = result.rows[0];

        res.json({
            message: `Post ${likeData.action} successfully`,
            action: likeData.action,
            likes_count: likeData.likes_count,
            is_liked: likeData.is_liked
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
};

// Get user's liked posts
exports.getLikedPosts = async (req, res) => {
    const { user_id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    try {
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT 
                pl.*,
                p.title,
                p.description,
                p.price,
                p.media_url,
                p.type,
                p.likes_count,
                c.name as category_name,
                u.full_name as advertiser_name
            FROM post_likes pl
            JOIN posts p ON pl.post_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            WHERE pl.user_id = $1
            ORDER BY pl.created_at DESC
            LIMIT $2 OFFSET $3
        `, [user_id, limit, offset]);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM post_likes WHERE user_id = $1',
            [user_id]
        );

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            liked_posts: result.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_liked: total,
                posts_per_page: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error retrieving liked posts:', error);
        res.status(500).json({ error: 'Failed to retrieve liked posts' });
    }
};

// Check if user has liked a post
exports.checkLikeStatus = async (req, res) => {
    const { post_id } = req.params;
    const user_id = req.user.id;

    try {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2) as is_liked',
            [user_id, post_id]
        );

        res.json({
            is_liked: result.rows[0].is_liked
        });
    } catch (error) {
        console.error('Error checking like status:', error);
        res.status(500).json({ error: 'Failed to check like status' });
    }
};

// Admin: Get all posts with detailed information
exports.getAllPostsAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', type, category_id, verified } = req.query;
        
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const offset = (pageNum - 1) * limitNum;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereClause += ` AND (p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (type && ['reel', 'post'].includes(type)) {
            paramCount++;
            whereClause += ` AND p.type = $${paramCount}`;
            params.push(type);
        }

        if (category_id) {
            paramCount++;
            whereClause += ` AND p.category_id = $${paramCount}`;
            params.push(category_id);
        }

        if (verified !== undefined) {
            paramCount++;
            whereClause += ` AND a.is_verified = $${paramCount}`;
            params.push(verified === 'true');
        }

        const query = `
            SELECT 
                p.*,
                c.name as category_name,
                a.store_name as advertiser_name,
                a.is_verified as advertiser_verified,
                COALESCE(pl.likes_count, 0) as likes_count,
                COALESCE(r.reservations_count, 0) as reservations_count,
                COALESCE(cm.comments_count, 0) as comments_count
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN advertisers a ON p.advertiser_id = a.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as likes_count 
                FROM post_likes 
                GROUP BY post_id
            ) pl ON p.id = pl.post_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as reservations_count 
                FROM reservations 
                WHERE status = 'active'
                GROUP BY post_id
            ) r ON p.id = r.post_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as comments_count 
                FROM comments 
                GROUP BY post_id
            ) cm ON p.id = cm.post_id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        params.push(limitNum, offset);
        const result = await pool.query(query, params);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM posts p
            LEFT JOIN advertisers a ON p.advertiser_id = a.id
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        res.json({
            success: true,
            message: 'Posts retrieved successfully',
            data: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total_posts: total,
                posts_per_page: limitNum
            }
        });
    } catch (error) {
        console.error('Error getting all posts admin:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to retrieve posts' 
        });
    }
};

// Admin: Get post statistics
exports.getPostStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_posts,
                COUNT(CASE WHEN type = 'reel' THEN 1 END) as total_reels,
                COUNT(CASE WHEN type = 'post' THEN 1 END) as total_product_posts,
                COUNT(CASE WHEN with_reservation = true THEN 1 END) as posts_with_reservations,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as posts_last_7_days,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as posts_last_30_days,
                AVG(CASE WHEN price IS NOT NULL THEN price END) as average_price,
                SUM(CASE WHEN likes_count > 0 THEN likes_count ELSE 0 END) as total_likes
            FROM posts
        `;

        const statsResult = await pool.query(statsQuery);
        const stats = statsResult.rows[0];

        // Get top categories
        const categoryQuery = `
            SELECT 
                c.name as category_name,
                COUNT(p.id) as post_count
            FROM categories c
            LEFT JOIN posts p ON c.id = p.category_id
            GROUP BY c.id, c.name
            ORDER BY post_count DESC
            LIMIT 5
        `;
        const categoryResult = await pool.query(categoryQuery);

        // Get top advertisers by posts
        const advertiserQuery = `
            SELECT 
                a.store_name,
                COUNT(p.id) as post_count,
                a.is_verified
            FROM advertisers a
            LEFT JOIN posts p ON a.id = p.advertiser_id
            GROUP BY a.id, a.store_name, a.is_verified
            ORDER BY post_count DESC
            LIMIT 10
        `;
        const advertiserResult = await pool.query(advertiserQuery);

        res.json({
            success: true,
            message: 'Post statistics retrieved successfully',
            data: {
                overview: stats,
                top_categories: categoryResult.rows,
                top_advertisers: advertiserResult.rows
            }
        });
    } catch (error) {
        console.error('Error getting post statistics:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to retrieve post statistics' 
        });
    }
};