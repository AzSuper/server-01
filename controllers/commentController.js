const { pool } = require('../config/db');

class CommentController {
    static async createComment(req, res) {
        const userId = req.user?.id;
        const userType = req.user?.type;
        const { post_id, content, parent_comment_id } = req.body;

        try {
            if (!userId || !userType) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!post_id || !content || String(content).trim().length === 0) {
                return res.status(400).json({ error: 'post_id and non-empty content are required' });
            }

            // Ensure post exists
            const post = await pool.query('SELECT id FROM posts WHERE id = $1', [post_id]);
            if (post.rows.length === 0) {
                return res.status(404).json({ error: 'Post not found' });
            }

            // If parent_comment_id provided, ensure it exists and belongs to same post
            if (parent_comment_id) {
                const parent = await pool.query('SELECT id, post_id FROM comments WHERE id = $1', [parent_comment_id]);
                if (parent.rows.length === 0) {
                    return res.status(400).json({ error: 'Parent comment not found' });
                }
                if (parent.rows[0].post_id !== parseInt(post_id)) {
                    return res.status(400).json({ error: 'Parent comment must belong to the same post' });
                }
            }

            const result = await pool.query(
                `INSERT INTO comments (post_id, user_id, user_type, parent_comment_id, content)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [post_id, userId, userType, parent_comment_id || null, content]
            );

            res.status(201).json({ comment: result.rows[0] });
        } catch (error) {
            console.error('Error creating comment:', error);
            res.status(500).json({ error: 'Failed to create comment' });
        }
    }

    static async getPostComments(req, res) {
        const { post_id } = req.params;
        try {
            const result = await pool.query(`
                SELECT 
                    c.id, c.post_id, c.user_id, c.user_type, c.parent_comment_id, c.content, c.status, c.created_at, c.updated_at,
                    CASE 
                        WHEN c.user_type = 'user' THEN u.full_name
                        WHEN c.user_type = 'advertiser' THEN a.full_name
                    END as author_name,
                    CASE 
                        WHEN c.user_type = 'user' THEN u.profile_image
                        WHEN c.user_type = 'advertiser' THEN a.store_image
                    END as author_avatar
                FROM comments c
                LEFT JOIN users u ON u.id = c.user_id AND c.user_type = 'user'
                LEFT JOIN advertisers a ON a.id = c.user_id AND c.user_type = 'advertiser'
                WHERE c.post_id = $1 AND c.status = 'visible'
                ORDER BY c.created_at ASC
            `, [post_id]);

            res.json({ comments: result.rows, total: result.rows.length });
        } catch (error) {
            console.error('Error fetching comments:', error);
            res.status(500).json({ error: 'Failed to fetch comments' });
        }
    }

    static async deleteComment(req, res) {
        const userId = req.user?.id;
        const userType = req.user?.type;
        const { comment_id } = req.params;
        try {
            const existing = await pool.query('SELECT id, user_id, user_type, status FROM comments WHERE id = $1', [comment_id]);
            if (existing.rows.length === 0) {
                return res.status(404).json({ error: 'Comment not found' });
            }
            const comment = existing.rows[0];
            if (comment.user_id !== userId || comment.user_type !== userType) {
                return res.status(403).json({ error: 'You can only delete your own comments' });
            }
            if (comment.status === 'deleted') {
                return res.status(200).json({ message: 'Comment already deleted' });
            }

            const result = await pool.query(
                `UPDATE comments SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`,
                [comment_id]
            );
            res.json({ message: 'Comment deleted', comment: result.rows[0] });
        } catch (error) {
            console.error('Error deleting comment:', error);
            res.status(500).json({ error: 'Failed to delete comment' });
        }
    }

    // Admin: Get all comments with detailed information
    static async getAllCommentsAdmin(req, res) {
        try {
            const { page = 1, limit = 20, status, user_type, post_id } = req.query;
            
            const pageNum = parseInt(page) || 1;
            const limitNum = Math.min(parseInt(limit) || 20, 100);
            const offset = (pageNum - 1) * limitNum;
            
            let whereClause = 'WHERE 1=1';
            const params = [];
            let paramCount = 0;

            if (status && ['visible', 'deleted', 'hidden'].includes(status)) {
                paramCount++;
                whereClause += ` AND c.status = $${paramCount}`;
                params.push(status);
            }

            if (user_type && ['user', 'advertiser'].includes(user_type)) {
                paramCount++;
                whereClause += ` AND c.user_type = $${paramCount}`;
                params.push(user_type);
            }

            if (post_id) {
                paramCount++;
                whereClause += ` AND c.post_id = $${paramCount}`;
                params.push(post_id);
            }

            const query = `
                SELECT 
                    c.*,
                    p.title as post_title,
                    p.type as post_type,
                    p.media_url as post_media,
                    a.store_name as advertiser_name,
                    CASE 
                        WHEN c.user_type = 'user' THEN u.full_name
                        WHEN c.user_type = 'advertiser' THEN adv.full_name
                    END as author_name,
                    CASE 
                        WHEN c.user_type = 'user' THEN u.phone
                        WHEN c.user_type = 'advertiser' THEN adv.phone
                    END as author_phone
                FROM comments c
                JOIN posts p ON c.post_id = p.id
                JOIN advertisers a ON p.advertiser_id = a.id
                LEFT JOIN users u ON c.user_id = u.id AND c.user_type = 'user'
                LEFT JOIN advertisers adv ON c.user_id = adv.id AND c.user_type = 'advertiser'
                ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            params.push(limitNum, offset);
            const result = await pool.query(query, params);

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM comments c
                ${whereClause}
            `;
            const countResult = await pool.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            res.json({
                success: true,
                message: 'Comments retrieved successfully',
                data: result.rows,
                pagination: {
                    current_page: pageNum,
                    total_pages: Math.ceil(total / limitNum),
                    total_comments: total,
                    comments_per_page: limitNum
                }
            });
        } catch (error) {
            console.error('Error getting all comments admin:', error);
            res.status(500).json({ 
                success: false,
                message: 'Failed to retrieve comments' 
            });
        }
    }

    // Admin: Get comment statistics
    static async getCommentStats(req, res) {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_comments,
                    COUNT(CASE WHEN status = 'visible' THEN 1 END) as visible_comments,
                    COUNT(CASE WHEN status = 'deleted' THEN 1 END) as deleted_comments,
                    COUNT(CASE WHEN status = 'hidden' THEN 1 END) as hidden_comments,
                    COUNT(CASE WHEN user_type = 'user' THEN 1 END) as user_comments,
                    COUNT(CASE WHEN user_type = 'advertiser' THEN 1 END) as advertiser_comments,
                    COUNT(CASE WHEN parent_comment_id IS NOT NULL THEN 1 END) as reply_comments,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as comments_last_7_days,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as comments_last_30_days
                FROM comments
            `;

            const statsResult = await pool.query(statsQuery);
            const stats = statsResult.rows[0];

            // Get top posts by comments
            const topPostsQuery = `
                SELECT 
                    p.title,
                    p.type,
                    COUNT(c.id) as comment_count,
                    a.store_name as advertiser_name
                FROM posts p
                JOIN advertisers a ON p.advertiser_id = a.id
                LEFT JOIN comments c ON p.id = c.post_id AND c.status = 'visible'
                GROUP BY p.id, p.title, p.type, a.store_name
                ORDER BY comment_count DESC
                LIMIT 10
            `;
            const topPostsResult = await pool.query(topPostsQuery);

            // Get comment trends by day (last 7 days)
            const trendsQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM comments
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY DATE(created_at)
                ORDER BY date
            `;
            const trendsResult = await pool.query(trendsQuery);

            // Get top commenters
            const topCommentersQuery = `
                SELECT 
                    CASE 
                        WHEN c.user_type = 'user' THEN u.full_name
                        WHEN c.user_type = 'advertiser' THEN adv.full_name
                    END as author_name,
                    c.user_type,
                    COUNT(c.id) as comment_count
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id AND c.user_type = 'user'
                LEFT JOIN advertisers adv ON c.user_id = adv.id AND c.user_type = 'advertiser'
                WHERE c.status = 'visible'
                GROUP BY c.user_id, c.user_type, u.full_name, adv.full_name
                ORDER BY comment_count DESC
                LIMIT 10
            `;
            const topCommentersResult = await pool.query(topCommentersQuery);

            res.json({
                success: true,
                message: 'Comment statistics retrieved successfully',
                data: {
                    overview: stats,
                    top_posts: topPostsResult.rows,
                    trends: trendsResult.rows,
                    top_commenters: topCommentersResult.rows
                }
            });
        } catch (error) {
            console.error('Error getting comment statistics:', error);
            res.status(500).json({ 
                success: false,
                message: 'Failed to retrieve comment statistics' 
            });
        }
    }
}

module.exports = CommentController;


