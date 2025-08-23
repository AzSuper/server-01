const { pool } = require('../config/db');
const { AppError, handleDatabaseError } = require('../utils/errorHandler');
const { logger } = require('../utils/logger');

class ReservationController {
    
    // Create a new reservation with full validation
    static async createReservation(req, res) {
        const { client_id, post_id } = req.body;

        try {
            // 1. Validate input
            if (!client_id || !post_id) {
                return res.status(400).json({ 
                    error: 'client_id and post_id are required' 
                });
            }

            // 2. Check if post exists and supports reservations
            const postResult = await pool.query(`
                SELECT * FROM posts 
                WHERE id = $1 AND with_reservation = true
            `, [post_id]);

            if (postResult.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Post not found or does not support reservations' 
                });
            }

            const post = postResult.rows[0];

            // 3. Check if client exists
            const clientResult = await pool.query(
                'SELECT id FROM users WHERE id = $1', 
                [client_id]
            );

            if (clientResult.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Client not found' 
                });
            }

            // 4. Check if client already has a reservation for this post
            const existingReservation = await pool.query(`
                SELECT id, status FROM reservations 
                WHERE client_id = $1 AND post_id = $2
            `, [client_id, post_id]);

            if (existingReservation.rows.length > 0 && existingReservation.rows[0].status === 'active') {
                return res.status(409).json({ 
                    error: 'You already have a reservation for this post' 
                });
            }

            // 5. Check reservation time limit (if set)
            if (post.reservation_time) {
                const reservationTime = new Date(post.reservation_time);
                const currentTime = new Date();
                
                if (currentTime > reservationTime) {
                    return res.status(400).json({ 
                        error: 'Reservation time has expired' 
                    });
                }
            }

            // 6. Check reservation limit (if set)
            if (post.reservation_limit) {
                const reservationCount = await pool.query(`
                    SELECT COUNT(*) as count FROM reservations 
                    WHERE post_id = $1 AND status = 'active'
                `, [post_id]);

                const currentCount = parseInt(reservationCount.rows[0].count);
                
                if (currentCount >= post.reservation_limit) {
                    return res.status(400).json({ 
                        error: `Reservation limit reached. Maximum ${post.reservation_limit} reservations allowed`,
                        available_slots: 0,
                        total_slots: post.reservation_limit
                    });
                }
            }

            // 7. Create the reservation
            let reservationId;
            if (existingReservation.rows.length > 0 && existingReservation.rows[0].status === 'cancelled') {
                const revived = await pool.query(`
                    UPDATE reservations SET status = 'active', reserved_at = NOW(), cancelled_at = NULL 
                    WHERE id = $1 RETURNING *
                `, [existingReservation.rows[0].id]);
                reservationId = revived.rows[0].id;
            } else {
                const reservationResult = await pool.query(`
                    INSERT INTO reservations (client_id, post_id, reserved_at) 
                    VALUES ($1, $2, NOW()) 
                    RETURNING *
                `, [client_id, post_id]);
                reservationId = reservationResult.rows[0].id;
            }

            // 8. Get reservation details with post and user info
            const fullReservationResult = await pool.query(`
                SELECT 
                    r.*,
                    p.title as post_title,
                    p.price,
                    p.reservation_time,
                    p.reservation_limit,
                    u.name as client_name,
                    u.email as client_email
                FROM reservations r
                JOIN posts p ON r.post_id = p.id
                JOIN users u ON r.client_id = u.id
                WHERE r.id = $1
            `, [reservationId]);

            res.status(201).json({
                message: 'Reservation created successfully',
                reservation: fullReservationResult.rows[0]
            });

        } catch (error) {
            logger.error('Error creating reservation:', error);
            
            // Handle database-specific errors
            if (error.code) {
                const dbError = handleDatabaseError(error);
                return res.status(dbError.statusCode).json({ 
                    error: dbError.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Failed to create reservation' 
            });
        }
    }

    // Get reservations for a specific client
    static async getClientReservations(req, res) {
        const { client_id } = req.params;

        try {
            const result = await pool.query(`
                SELECT 
                    r.*,
                    p.title,
                    p.description,
                    p.price,
                    p.media_url,
                    p.reservation_time,
                    p.social_link,
                    u.name as advertiser_name,
                    u.email as advertiser_email,
                    c.name as category_name
                FROM reservations r
                JOIN posts p ON r.post_id = p.id
                JOIN users u ON p.advertiser_id = u.id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE r.client_id = $1
                ORDER BY r.reserved_at DESC
            `, [client_id]);

            res.json({
                reservations: result.rows,
                total: result.rows.length
            });

        } catch (error) {
            logger.error('Error retrieving client reservations:', error);
            
            // Handle database-specific errors
            if (error.code) {
                const dbError = handleDatabaseError(error);
                return res.status(dbError.statusCode).json({ 
                    error: dbError.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Failed to retrieve reservations' 
            });
        }
    }

    // Get reservations for a specific post (for advertisers)
    static async getPostReservations(req, res) {
        const { post_id } = req.params;

        try {
            const result = await pool.query(`
                SELECT 
                    r.*,
                    u.name as client_name,
                    u.email as client_email,
                    u.phone as client_phone
                FROM reservations r
                JOIN users u ON r.client_id = u.id
                WHERE r.post_id = $1 AND r.status = 'active'
                ORDER BY r.reserved_at DESC
            `, [post_id]);

            // Also get post details and reservation stats
            const postResult = await pool.query(`
                SELECT 
                    p.*,
                    COUNT(r.id) as total_reservations
                FROM posts p
                LEFT JOIN reservations r ON p.id = r.post_id AND r.status = 'active'
                WHERE p.id = $1
                GROUP BY p.id
            `, [post_id]);

            if (postResult.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Post not found' 
                });
            }

            const post = postResult.rows[0];
            const availableSlots = post.reservation_limit ? 
                post.reservation_limit - parseInt(post.total_reservations) : 
                null;

            res.json({
                post: {
                    id: post.id,
                    title: post.title,
                    reservation_limit: post.reservation_limit,
                    reservation_time: post.reservation_time,
                    total_reservations: parseInt(post.total_reservations),
                    available_slots: availableSlots
                },
                reservations: result.rows
            });

        } catch (error) {
            logger.error('Error retrieving post reservations:', error);
            
            // Handle database-specific errors
            if (error.code) {
                const dbError = handleDatabaseError(error);
                return res.status(dbError.statusCode).json({ 
                    error: dbError.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Failed to retrieve post reservations' 
            });
        }
    }

    // Cancel a reservation
    static async cancelReservation(req, res) {
        const { reservation_id } = req.params;
        const { client_id } = req.body; // Optional: verify ownership

        try {
            // Get reservation details first
            const reservationResult = await pool.query(`
                SELECT r.*, p.title as post_title
                FROM reservations r
                JOIN posts p ON r.post_id = p.id
                WHERE r.id = $1
            `, [reservation_id]);

            if (reservationResult.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Reservation not found' 
                });
            }

            const reservation = reservationResult.rows[0];

            // Check ownership if client_id is provided
            if (client_id && reservation.client_id !== parseInt(client_id)) {
                return res.status(403).json({ 
                    error: 'You can only cancel your own reservations' 
                });
            }

            // Delete the reservation
            await pool.query(`
                UPDATE reservations 
                SET status = 'cancelled', cancelled_at = NOW() 
                WHERE id = $1 AND status = 'active'
            `, [reservation_id]);

            res.json({
                message: 'Reservation cancelled successfully',
                cancelled_reservation: {
                    id: reservation.id,
                    post_title: reservation.post_title,
                    cancelled_at: new Date()
                }
            });

        } catch (error) {
            logger.error('Error cancelling reservation:', error);
            
            // Handle database-specific errors
            if (error.code) {
                const dbError = handleDatabaseError(error);
                return res.status(dbError.statusCode).json({ 
                    error: dbError.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Failed to cancel reservation' 
            });
        }
    }

    // Check reservation availability for a post
    static async checkAvailability(req, res) {
        const { post_id } = req.params;

        try {
            const result = await pool.query(`
                SELECT 
                    p.id,
                    p.title,
                    p.with_reservation,
                    p.reservation_limit,
                    p.reservation_time,
                    COUNT(r.id) as current_reservations
                FROM posts p
                LEFT JOIN reservations r ON p.id = r.post_id
                WHERE p.id = $1
                GROUP BY p.id
            `, [post_id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Post not found' 
                });
            }

            const post = result.rows[0];
            const currentReservations = parseInt(post.current_reservations);
            
            let availability = {
                post_id: post.id,
                title: post.title,
                accepts_reservations: post.with_reservation,
                is_available: false,
                reason: null
            };

            if (!post.with_reservation) {
                availability.reason = 'Post does not accept reservations';
            } else if (post.reservation_time && new Date() > new Date(post.reservation_time)) {
                availability.reason = 'Reservation time has expired';
            } else if (post.reservation_limit && currentReservations >= post.reservation_limit) {
                availability.reason = 'Reservation limit reached';
                availability.available_slots = 0;
                availability.total_slots = post.reservation_limit;
            } else {
                availability.is_available = true;
                availability.current_reservations = currentReservations;
                if (post.reservation_limit) {
                    availability.available_slots = post.reservation_limit - currentReservations;
                    availability.total_slots = post.reservation_limit;
                }
                if (post.reservation_time) {
                    availability.reservation_deadline = post.reservation_time;
                }
            }

            res.json(availability);

        } catch (error) {
            logger.error('Error checking availability:', error);
            
            // Handle database-specific errors
            if (error.code) {
                const dbError = handleDatabaseError(error);
                return res.status(dbError.statusCode).json({ 
                    error: dbError.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Failed to check availability' 
            });
        }
    }

    // Get reservation statistics for an advertiser
    static async getAdvertiserReservationStats(req, res) {
        const { advertiser_id } = req.params;

        try {
            const result = await pool.query(`
                SELECT 
                    p.id as post_id,
                    p.title,
                    p.type,
                    p.reservation_limit,
                    p.reservation_time,
                    COUNT(r.id) as total_reservations,
                    p.created_at as post_created_at
                FROM posts p
                LEFT JOIN reservations r ON p.id = r.post_id
                WHERE p.advertiser_id = $1 AND p.with_reservation = true
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `, [advertiser_id]);

            const stats = result.rows.map(post => ({
                post_id: post.post_id,
                title: post.title,
                type: post.type,
                total_reservations: parseInt(post.total_reservations),
                reservation_limit: post.reservation_limit,
                available_slots: post.reservation_limit ? 
                    post.reservation_limit - parseInt(post.total_reservations) : null,
                reservation_time: post.reservation_time,
                is_expired: post.reservation_time ? 
                    new Date() > new Date(post.reservation_time) : false,
                post_created_at: post.post_created_at
            }));

            const summary = {
                total_posts_with_reservations: result.rows.length,
                total_reservations: result.rows.reduce((sum, post) => 
                    sum + parseInt(post.total_reservations), 0),
                active_posts: result.rows.filter(post => 
                    !post.reservation_time || new Date() <= new Date(post.reservation_time)
                ).length
            };

            res.json({
                summary,
                posts: stats
            });

        } catch (error) {
            logger.error('Error getting advertiser reservation stats:', error);
            
            // Handle database-specific errors
            if (error.code) {
                const dbError = handleDatabaseError(error);
                return res.status(dbError.statusCode).json({ 
                    error: dbError.message 
                });
            }
            
            res.status(500).json({ 
                error: 'Failed to get reservation statistics' 
            });
        }
    }
}

module.exports = ReservationController;