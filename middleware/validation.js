// Validation middleware (no DB access required here)

// Validate reservation request
exports.validateReservationRequest = (req, res, next) => {
    const { client_id, post_id } = req.body;
    
    // Basic validation
    if (!client_id || !post_id) {
        return res.status(400).json({
            error: 'Missing required fields',
            required_fields: ['client_id', 'post_id']
        });
    }

    // Validate data types
    if (!Number.isInteger(parseInt(client_id)) || !Number.isInteger(parseInt(post_id))) {
        return res.status(400).json({
            error: 'client_id and post_id must be valid integers'
        });
    }

    next();
};

// Validate post creation request
exports.validatePostRequest = (req, res, next) => {
    const { advertiser_id, type, title } = req.body;
    
    // Check required fields
    if (!advertiser_id || !type || !title) {
        return res.status(400).json({
            error: 'Missing required fields',
            required_fields: ['advertiser_id', 'type', 'title']
        });
    }

    // Validate post type
    if (!['reel', 'post'].includes(type)) {
        return res.status(400).json({
            error: 'Invalid post type',
            valid_types: ['reel', 'post']
        });
    }

    // Validate file upload
    if (!req.file) {
        return res.status(400).json({
            error: 'Media file is required'
        });
    }

    next();
};

// Check user ownership (for protecting resources)
exports.checkUserOwnership = async (req, res, next) => {
    try {
        const userId = req.user.id; // From JWT token
        const { client_id, advertiser_id } = req.params;
        
        // Check if user is trying to access their own data
        const targetUserId = client_id || advertiser_id;
        
        if (targetUserId && parseInt(targetUserId) !== userId) {
            return res.status(403).json({
                error: 'Access denied: You can only access your own data'
            });
        }

        next();
    } catch (error) {
        console.error('Error checking user ownership:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

// Rate limiting for reservations (prevent spam)
const reservationAttempts = new Map();

exports.rateLimitReservations = (req, res, next) => {
    const { client_id } = req.body;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxAttempts = 5; // Max 5 reservations per minute

    const key = `reservation_${client_id}`;
    const attempts = reservationAttempts.get(key) || [];
    
    // Remove old attempts outside the time window
    const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
        return res.status(429).json({
            error: 'Too many reservation attempts',
            retry_after: Math.ceil((windowMs - (now - recentAttempts[0])) / 1000),
            max_attempts_per_minute: maxAttempts
        });
    }
    
    // Add current attempt
    recentAttempts.push(now);
    reservationAttempts.set(key, recentAttempts);
    
    next();
};

// Error handling middleware
exports.errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File size too large',
            max_size: '5MB'
        });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            error: 'Too many files uploaded',
            max_files: 1
        });
    }

    // PostgreSQL errors
    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json({
            error: 'Invalid reference to related data'
        });
    }

    if (err.code === '23505') { // Unique constraint violation
        return res.status(409).json({
            error: 'Resource already exists'
        });
    }

    // Cloudinary errors
    if (err.name === 'CloudinaryError') {
        return res.status(400).json({
            error: 'Media upload failed',
            details: err.message
        });
    }

    // Default error
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
};