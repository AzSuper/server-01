const { pool } = require('../config/db');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

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
        advertiser_id, 
        category_id, 
        type, 
        title, 
        description, 
        price, 
        old_price, 
        expiration_date,
        with_reservation, 
        reservation_time, 
        reservation_limit, 
        social_media_links 
    } = req.body;

    try {

        // Validation passed

        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate required fields
        if (!advertiser_id || !type || !title) {
            return res.status(400).json({ 
                error: 'advertiser_id, type, and title are required' 
            });
        }

        // Validate post type
        if (!['reel', 'post'].includes(type)) {
            return res.status(400).json({ 
                error: 'type must be either "reel" or "post"' 
            });
        }

        // Validate post type specific requirements
        if (type === 'reel') {
            // Reel: Video media + Description
            if (!description) {
                return res.status(400).json({ 
                    error: 'Description is required for reel posts' 
                });
            }
        } else if (type === 'post') {
            // Post: Image media + title + expiration date + product price + old price (optional) + post type
            if (!title) {
                return res.status(400).json({ 
                    error: 'Title is required for post type' 
                });
            }
            if (!expiration_date) {
                return res.status(400).json({ 
                    error: 'Expiration date is required for post type' 
                });
            }
            if (price === undefined || price === null) {
                return res.status(400).json({ 
                    error: 'Product price is required for post type' 
                });
            }
        }

        // Validate advertiser exists
        const advertiserResult = await pool.query(
            'SELECT id, role FROM users WHERE id = $1', 
            [advertiser_id]
        );

        if (advertiserResult.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Advertiser not found' 
            });
        }

        // Ensure caller is the same advertiser (or admin)
        const caller = req.user;
        if (!caller) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const isAdmin = caller.role === 'admin';
        if (!isAdmin && parseInt(advertiser_id) !== caller.id) {
            return res.status(403).json({ error: 'Forbidden: cannot create posts for another advertiser' });
        }

        // Upload media to Cloudinary
        logger.info(`Starting Cloudinary upload for file: ${req.file.path}`);
        const mediaUpload = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto', // Automatically determine resource type (image/video)
        });
        logger.info(`Cloudinary upload successful: ${mediaUpload.secure_url}`);

        // Parse reservation data
        const withReservation = with_reservation === 'true' || with_reservation === true;
        const parsedReservationTime = reservation_time ? new Date(reservation_time) : null;
        const parsedReservationLimit = reservation_limit ? parseInt(reservation_limit) : null;
        const parsedExpirationDate = expiration_date ? new Date(expiration_date) : null;

        // Validate reservation data if reservation is enabled
        if (withReservation) {
            if (parsedReservationTime && parsedReservationTime <= new Date()) {
                return res.status(400).json({ 
                    error: 'Reservation time must be in the future' 
                });
            }
            if (parsedReservationLimit && parsedReservationLimit <= 0) {
                return res.status(400).json({ 
                    error: 'Reservation limit must be greater than 0' 
                });
            }
        }

        // Create the post in the database
        logger.info(`Creating post in database with advertiser_id: ${advertiser_id}, type: ${type}, title: ${title}`);
        const result = await pool.query(
            'INSERT INTO posts (advertiser_id, category_id, type, title, description, price, old_price, expiration_date, with_reservation, reservation_time, reservation_limit, social_media_links, media_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
            [advertiser_id, category_id, type, title, description, price, old_price, parsedExpirationDate, withReservation, parsedReservationTime, parsedReservationLimit, social_media_links || null, mediaUpload.secure_url]
        );
        logger.info(`Post created in database with ID: ${result.rows[0].id}`);

        // Clean up temporary file
        fs.unlink(req.file.path, (err) => {
            if (err) {
                console.error('Error deleting temporary file:', err);
            }
        });

        // Get the complete post with category and advertiser info
        logger.info(`Fetching complete post details for ID: ${result.rows[0].id}`);
        const completePostResult = await pool.query(`
            SELECT 
                p.*,
                c.name as category_name,
                u.name as advertiser_name
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            WHERE p.id = $1
        `, [result.rows[0].id]);
        logger.info(`Complete post details fetched successfully`);

        res.status(201).json({
            message: 'Post created successfully',
            post: completePostResult.rows[0]
        });
    } catch (error) {
        console.error('Error creating post:', error);
        logger.error(`Post creation failed: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
        res.status(500).json({ 
            error: 'Post creation failed',
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
                u.name as advertiser_name,
                COUNT(CASE WHEN r.status = 'active' THEN 1 END) as reservation_count
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            LEFT JOIN reservations r ON p.id = r.post_id AND r.status = 'active'
            ${whereClause}
            GROUP BY p.id, c.name, u.name
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
                u.name as advertiser_name,
                u.email as advertiser_email,
                COUNT(CASE WHEN r.status = 'active' THEN 1 END) as reservation_count
            FROM posts p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.advertiser_id = u.id
            LEFT JOIN reservations r ON p.id = r.post_id AND r.status = 'active'
            WHERE p.id = $1
            GROUP BY p.id, c.name, u.name, u.email
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
                u.name as advertiser_name
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
                u.name as advertiser_name
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