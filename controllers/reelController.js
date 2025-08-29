const { pool } = require('../config/db');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { logger } = require('../utils/logger');

// Create a new reel
exports.createReel = async (req, res) => {
    const { description } = req.body;
    const advertiser_id = req.user.id;
    
    try {
        // Debug logging for request
        logger.info('=== Reel Creation Request Debug ===');
        logger.info('Request body:', req.body);
        logger.info('Request files:', req.files);
        logger.info('Content-Type:', req.get('Content-Type'));
        logger.info('Advertiser ID from token:', advertiser_id);
        logger.info('=== End Request Debug ===');

        // Validate required fields for reels
        if (!description) {
            return res.status(400).json({ 
                error: 'Description is required for reels' 
            });
        }

        // Validate user is an advertiser
        if (req.user.type !== 'advertiser') {
            logger.error(`Forbidden: User ${req.user.id} (type: ${req.user.type}) trying to create reel`);
            return res.status(403).json({ error: 'Forbidden: only advertisers can create reels' });
        }
        
        logger.info(`Authorization passed for advertiser ${req.user.id} creating reel`);

        // Check if a file was uploaded
        let uploadedFile = null;
        
        // Check for files in req.files (from upload.any)
        if (req.files && req.files.length > 0) {
            uploadedFile = req.files[0];
            logger.info(`File found in req.files: ${uploadedFile.originalname}, fieldname: ${uploadedFile.fieldname}`);
        }
        
        if (!uploadedFile) {
            logger.error('No file uploaded in request');
            logger.error('req.files:', req.files);
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        // Validate file type (should be video)
        const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv'];
        if (!allowedVideoTypes.includes(uploadedFile.mimetype)) {
            logger.error(`Invalid file type: ${uploadedFile.mimetype}`);
            return res.status(400).json({ error: 'Only video files are allowed for reels' });
        }

        logger.info(`Video file uploaded: ${uploadedFile.originalname}, size: ${uploadedFile.size}, type: ${uploadedFile.mimetype}`);

        // Upload video to Cloudinary
        logger.info(`Starting Cloudinary upload for video: ${uploadedFile.path}`);
        
        // Validate Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            logger.error('Cloudinary configuration missing');
            return res.status(500).json({ error: 'Video upload service not configured' });
        }
        
        const videoUpload = await cloudinary.uploader.upload(uploadedFile.path, {
            resource_type: 'video',
            folder: 'reels',
            allowed_formats: ['mp4', 'avi', 'mov', 'wmv', 'flv']
        });
        logger.info(`Cloudinary upload successful: ${videoUpload.secure_url}`);

        // Create the reel in the database
        logger.info(`Creating reel in database with advertiser_id: ${advertiser_id}`);
        
        let result;
        try {
            result = await pool.query(
                'INSERT INTO reels (advertiser_id, description, video_url) VALUES ($1, $2, $3) RETURNING *',
                [advertiser_id, description, videoUpload.secure_url]
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
                r.*,
                u.full_name as advertiser_name
            FROM reels r
            JOIN users u ON r.advertiser_id = u.id
            WHERE r.id = $1
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

// Get all reels with pagination
exports.getReels = async (req, res) => {
    const { page = 1, limit = 10, advertiser_id } = req.query;
    
    try {
        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        // Build dynamic WHERE clause
        if (advertiser_id) {
            paramCount++;
            whereConditions.push(`r.advertiser_id = $${paramCount}`);
            queryParams.push(advertiser_id);
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

        // Get reels with pagination
        const reelsResult = await pool.query(`
            SELECT 
                r.*,
                u.full_name as advertiser_name
            FROM reels r
            JOIN users u ON r.advertiser_id = u.id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `, queryParams);

        // Get total count for pagination
        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM reels r
            ${whereClause}
        `, whereConditions.length > 0 ? queryParams.slice(0, -2) : []);

        const totalReels = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalReels / limit);

        res.json({
            reels: reelsResult.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_reels: totalReels,
                limit: parseInt(limit),
                has_next: page < totalPages,
                has_prev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting reels:', error);
        logger.error(`Get reels failed: ${error.message}`);
        res.status(500).json({ 
            error: 'Failed to retrieve reels',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get reel by ID
exports.getReelById = async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                u.full_name as advertiser_name
            FROM reels r
            JOIN users u ON r.advertiser_id = u.id
            WHERE r.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reel not found' });
        }

        // Increment view count
        await pool.query(
            'UPDATE reels SET views_count = views_count + 1 WHERE id = $1',
            [id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting reel:', error);
        logger.error(`Get reel failed: ${error.message}`);
        res.status(500).json({ 
            error: 'Failed to retrieve reel',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Like/Unlike reel
exports.toggleReelLike = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    
    try {
        // Check if reel exists
        const reelResult = await pool.query('SELECT id FROM reels WHERE id = $1', [id]);
        if (reelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reel not found' });
        }

        // Check if user already liked the reel
        const likeResult = await pool.query(
            'SELECT id FROM reel_likes WHERE reel_id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (likeResult.rows.length > 0) {
            // Unlike: remove like and decrease count
            await pool.query(
                'DELETE FROM reel_likes WHERE reel_id = $1 AND user_id = $2',
                [id, user_id]
            );
            await pool.query(
                'UPDATE reels SET likes_count = likes_count - 1 WHERE id = $1',
                [id]
            );
            
            res.json({ 
                message: 'Reel unliked successfully',
                liked: false
            });
        } else {
            // Like: add like and increase count
            await pool.query(
                'INSERT INTO reel_likes (reel_id, user_id) VALUES ($1, $2)',
                [id, user_id]
            );
            await pool.query(
                'UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1',
                [id]
            );
            
            res.json({ 
                message: 'Reel liked successfully',
                liked: true
            });
        }
    } catch (error) {
        console.error('Error toggling reel like:', error);
        logger.error(`Toggle reel like failed: ${error.message}`);
        res.status(500).json({ 
            error: 'Failed to toggle reel like',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get reel like status
exports.getReelLikeStatus = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    
    try {
        // Check if user liked the reel
        const likeResult = await pool.query(
            'SELECT id FROM reel_likes WHERE reel_id = $1 AND user_id = $2',
            [id, user_id]
        );

        // Get current likes count
        const reelResult = await pool.query(
            'SELECT likes_count FROM reels WHERE id = $1',
            [id]
        );

        if (reelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reel not found' });
        }

        res.json({
            liked: likeResult.rows.length > 0,
            likes_count: reelResult.rows[0].likes_count
        });
    } catch (error) {
        console.error('Error getting reel like status:', error);
        logger.error(`Get reel like status failed: ${error.message}`);
        res.status(500).json({ 
            error: 'Failed to get reel like status',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
