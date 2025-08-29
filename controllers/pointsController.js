const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

// Get all user points (admin)
exports.getAllUserPoints = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const userType = req.query.userType;

        // Build WHERE clause for search and filtering
        let whereClause = '';
        let queryParams = [];
        let paramCount = 0;

        if (search) {
            whereClause += ` AND (LOWER(u.full_name) LIKE LOWER($${++paramCount}) OR LOWER(a.full_name) LIKE LOWER($${paramCount}) OR u.phone LIKE $${paramCount} OR a.phone LIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
        }

        if (userType && userType !== 'all') {
            whereClause += ` AND up.user_type = $${++paramCount}`;
            queryParams.push(userType);
        }

        // Get total count with search/filter
        let countQuery = `
            SELECT COUNT(*) FROM user_points up
            LEFT JOIN users u ON up.user_id = u.id AND up.user_type = 'user'
            LEFT JOIN advertisers a ON up.user_id = a.id AND up.user_type = 'advertiser'
            WHERE 1=1 ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalUsers = parseInt(countResult.rows[0].count);

        // Get user points with user details and search/filter
        const query = `
            SELECT 
                up.id,
                up.user_id,
                up.user_type,
                up.points_balance,
                up.total_earned,
                up.total_spent,
                up.created_at,
                up.updated_at,
                CASE 
                    WHEN up.user_type = 'user' THEN u.full_name
                    WHEN up.user_type = 'advertiser' THEN a.full_name
                END as user_name,
                CASE 
                    WHEN up.user_type = 'advertiser' THEN a.store_name
                    ELSE NULL
                END as store_name,
                CASE 
                    WHEN up.user_type = 'user' THEN u.phone
                    WHEN up.user_type = 'advertiser' THEN a.phone
                END as phone
            FROM user_points up
            LEFT JOIN users u ON up.user_id = u.id AND up.user_type = 'user'
            LEFT JOIN advertisers a ON up.user_id = a.id AND up.user_type = 'advertiser'
            WHERE 1=1 ${whereClause}
            ORDER BY up.points_balance DESC 
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;
        
        const finalParams = [...queryParams, limit, offset];
        const result = await pool.query(query, finalParams);

        res.json({
            message: 'User points retrieved successfully',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalUsers,
                pages: Math.ceil(totalUsers / limit)
            }
        });

    } catch (error) {
        logger.error('Get all user points error:', error);
        res.status(500).json({ error: 'Failed to retrieve user points' });
    }
};

// Get points statistics (admin)
exports.getPointsStats = async (req, res) => {
    try {
        // Get overall statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_users_with_points,
                SUM(points_balance) as total_points_in_circulation,
                SUM(total_earned) as total_points_ever_earned,
                SUM(total_spent) as total_points_ever_spent,
                AVG(points_balance) as average_points_per_user
            FROM user_points
        `;
        const statsResult = await pool.query(statsQuery);

        // Get recent transactions
        const recentTransactionsQuery = `
            SELECT 
                pt.*,
                CASE 
                    WHEN pt.user_type = 'user' THEN u.full_name
                    WHEN pt.user_type = 'advertiser' THEN a.full_name
                END as user_name
            FROM point_transactions pt
            LEFT JOIN users u ON pt.user_id = u.id AND pt.user_type = 'user'
            LEFT JOIN advertisers a ON pt.user_id = a.id AND pt.user_type = 'advertiser'
            ORDER BY pt.created_at DESC 
            LIMIT 10
        `;
        const transactionsResult = await pool.query(recentTransactionsQuery);

        // Get withdrawal requests count
        const withdrawalCountQuery = `
            SELECT COUNT(*) as pending_withdrawals
            FROM point_withdrawals 
            WHERE status = 'pending'
        `;
        const withdrawalResult = await pool.query(withdrawalCountQuery);

        res.json({
            message: 'Points statistics retrieved successfully',
            data: {
                overview: statsResult.rows[0],
                recentTransactions: transactionsResult.rows,
                pendingWithdrawals: parseInt(withdrawalResult.rows[0].pending_withdrawals)
            }
        });

    } catch (error) {
        logger.error('Get points stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve points statistics' });
    }
};

// Admin adjust user points
exports.adminAdjustPoints = async (req, res) => {
    try {
        const { userId, userType, pointsChange, reason, transactionType } = req.body;
        const { id } = req.params;

        if (!userId || !userType || !pointsChange || !reason) {
            return res.status(400).json({
                error: 'User ID, user type, points change, and reason are required'
            });
        }

        // Validate user exists
        let userExists = false;
        if (userType === 'user') {
            const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
            userExists = userResult.rows.length > 0;
        } else if (userType === 'advertiser') {
            const advertiserResult = await pool.query('SELECT id FROM advertisers WHERE id = $1', [userId]);
            userExists = advertiserResult.rows.length > 0;
        }

        if (!userExists) {
            return res.status(404).json({
                error: `${userType} not found`
            });
        }

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get or create user points record
            let userPointsResult = await client.query(
                'SELECT * FROM user_points WHERE user_id = $1 AND user_type = $2',
                [userId, userType]
            );

            if (userPointsResult.rows.length === 0) {
                // Create new user points record
                await client.query(
                    'INSERT INTO user_points (user_id, user_type, points_balance, total_earned, total_spent) VALUES ($1, $2, $3, $4, $5)',
                    [userId, userType, Math.max(0, pointsChange), Math.max(0, pointsChange), 0]
                );
            } else {
                // Update existing user points
                const currentBalance = userPointsResult.rows[0].points_balance;
                const newBalance = Math.max(0, currentBalance + pointsChange);
                
                await client.query(
                    'UPDATE user_points SET points_balance = $1, total_earned = total_earned + $2, total_spent = total_spent + $3 WHERE user_id = $4 AND user_type = $5',
                    [
                        newBalance,
                        Math.max(0, pointsChange),
                        Math.max(0, -pointsChange),
                        userId,
                        userType
                    ]
                );
            }

            // Record transaction
            await client.query(
                'INSERT INTO point_transactions (user_id, user_type, transaction_type, points_change, description, reference_type) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    userId,
                    userType,
                    transactionType || 'admin_adjustment',
                    pointsChange,
                    reason,
                    'admin_adjustment'
                ]
            );

            await client.query('COMMIT');

            // Get updated user points
            const updatedPointsResult = await pool.query(
                'SELECT * FROM user_points WHERE user_id = $1 AND user_type = $2',
                [userId, userType]
            );

            res.json({
                message: 'Points adjusted successfully',
                data: {
                    userId,
                    userType,
                    pointsChange,
                    newBalance: updatedPointsResult.rows[0].points_balance,
                    reason
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        logger.error('Admin adjust points error:', error);
        res.status(500).json({ error: 'Failed to adjust points' });
    }
};

// Get withdrawal requests (admin)
exports.getWithdrawalRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM point_withdrawals WHERE status = $1';
        const countResult = await pool.query(countQuery, ['pending']);
        const totalRequests = parseInt(countResult.rows[0].count);

        // Get withdrawal requests with user details
        const query = `
            SELECT 
                pw.*,
                CASE 
                    WHEN pw.user_type = 'user' THEN u.full_name
                    WHEN pw.user_type = 'advertiser' THEN a.full_name
                END as user_name,
                CASE 
                    WHEN pw.user_type = 'advertiser' THEN a.store_name
                    ELSE NULL
                END as store_name,
                CASE 
                    WHEN pw.user_type = 'user' THEN u.phone
                    WHEN pw.user_type = 'advertiser' THEN a.phone
                END as phone
            FROM point_withdrawals pw
            LEFT JOIN users u ON pw.user_id = u.id AND pw.user_type = 'user'
            LEFT JOIN advertisers a ON pw.user_id = a.id AND pw.user_type = 'advertiser'
            WHERE pw.status = 'pending'
            ORDER BY pw.created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        res.json({
            message: 'Withdrawal requests retrieved successfully',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalRequests,
                pages: Math.ceil(totalRequests / limit)
            }
        });

    } catch (error) {
        logger.error('Get withdrawal requests error:', error);
        res.status(500).json({ error: 'Failed to retrieve withdrawal requests' });
    }
};

// Approve withdrawal request (admin)
exports.approveWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        // Get withdrawal request
        const withdrawalResult = await pool.query(
            'SELECT * FROM point_withdrawals WHERE id = $1 AND status = $2',
            [id, 'pending']
        );

        if (withdrawalResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Withdrawal request not found or already processed'
            });
        }

        const withdrawal = withdrawalResult.rows[0];

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update withdrawal status
            await client.query(
                'UPDATE point_withdrawals SET status = $1, processed_at = NOW(), admin_notes = $2 WHERE id = $3',
                ['approved', adminNotes || 'Approved by admin', id]
            );

            // Deduct points from user
            await client.query(
                'UPDATE user_points SET points_balance = points_balance - $1, total_spent = total_spent + $1 WHERE user_id = $2 AND user_type = $3',
                [withdrawal.points_amount, withdrawal.user_id, withdrawal.user_type]
            );

            // Record transaction
            await client.query(
                'INSERT INTO point_transactions (user_id, user_type, transaction_type, points_change, description, reference_type, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [
                    withdrawal.user_id,
                    withdrawal.user_type,
                    'spent_withdrawal',
                    -withdrawal.points_amount,
                    `Withdrawal approved: ${withdrawal.withdrawal_method}`,
                    'withdrawal',
                    id
                ]
            );

            await client.query('COMMIT');

            res.json({
                message: 'Withdrawal request approved successfully',
                data: {
                    withdrawalId: id,
                    pointsAmount: withdrawal.points_amount,
                    userType: withdrawal.user_type,
                    userId: withdrawal.user_id
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        logger.error('Approve withdrawal error:', error);
        res.status(500).json({ error: 'Failed to approve withdrawal' });
    }
};

// Reject withdrawal request (admin)
exports.rejectWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes, reason } = req.body;

        if (!adminNotes || !reason) {
            return res.status(400).json({
                error: 'Admin notes and rejection reason are required'
            });
        }

        // Get withdrawal request
        const withdrawalResult = await pool.query(
            'SELECT * FROM point_withdrawals WHERE id = $1 AND status = $2',
            [id, 'pending']
        );

        if (withdrawalResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Withdrawal request not found or already processed'
            });
        }

        // Update withdrawal status
        await pool.query(
            'UPDATE point_withdrawals SET status = $1, processed_at = NOW(), admin_notes = $2, rejection_reason = $3 WHERE id = $4',
            ['rejected', adminNotes, reason, id]
        );

        res.json({
            message: 'Withdrawal request rejected successfully',
            data: {
                withdrawalId: id,
                reason,
                adminNotes
            }
        });

    } catch (error) {
        logger.error('Reject withdrawal error:', error);
        res.status(500).json({ error: 'Failed to reject withdrawal' });
    }
};

// User request points (public endpoint)
exports.requestPoints = async (req, res) => {
    try {
        const { userId, userType, pointsAmount, withdrawalMethod, accountDetails } = req.body;

        if (!userId || !userType || !pointsAmount || !withdrawalMethod || !accountDetails) {
            return res.status(400).json({
                error: 'All fields are required'
            });
        }

        if (pointsAmount <= 0) {
            return res.status(400).json({
                error: 'Points amount must be positive'
            });
        }

        // Validate user exists
        let userExists = false;
        if (userType === 'user') {
            const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
            userExists = userResult.rows.length > 0;
        } else if (userType === 'advertiser') {
            const advertiserResult = await pool.query('SELECT id FROM advertisers WHERE id = $1', [userId]);
            userExists = advertiserResult.rows.length > 0;
        }

        if (!userExists) {
            return res.status(404).json({
                error: `${userType} not found`
            });
        }

        // Check if user has enough points
        const userPointsResult = await pool.query(
            'SELECT points_balance FROM user_points WHERE user_id = $1 AND user_type = $2',
            [userId, userType]
        );

        if (userPointsResult.rows.length === 0 || userPointsResult.rows[0].points_balance < pointsAmount) {
            return res.status(400).json({
                error: 'Insufficient points balance'
            });
        }

        // Create withdrawal request
        const result = await pool.query(
            'INSERT INTO point_withdrawals (user_id, user_type, points_amount, withdrawal_method, account_details, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, userType, pointsAmount, withdrawalMethod, accountDetails, 'pending']
        );

        res.json({
            message: 'Points withdrawal request submitted successfully',
            data: {
                requestId: result.rows[0].id,
                pointsAmount,
                status: 'pending',
                submittedAt: result.rows[0].created_at
            }
        });

    } catch (error) {
        logger.error('Request points error:', error);
        res.status(500).json({ error: 'Failed to submit points request' });
    }
};

// Get user points balance (for authenticated users)
exports.getUserPoints = async (req, res) => {
    try {
        const { userId, userType } = req.params;

        if (!userId || !userType) {
            return res.status(400).json({
                error: 'User ID and user type are required'
            });
        }

        // Get user points
        const result = await pool.query(
            'SELECT * FROM user_points WHERE user_id = $1 AND user_type = $2',
            [userId, userType]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User points not found'
            });
        }

        // Get recent transactions
        const transactionsResult = await pool.query(
            'SELECT * FROM point_transactions WHERE user_id = $1 AND user_type = $2 ORDER BY created_at DESC LIMIT 10',
            [userId, userType]
        );

        res.json({
            message: 'User points retrieved successfully',
            data: {
                points: result.rows[0],
                recentTransactions: transactionsResult.rows
            }
        });

    } catch (error) {
        logger.error('Get user points error:', error);
        res.status(500).json({ error: 'Failed to retrieve user points' });
    }
};
