const { pool } = require('../config/db');

class CommentController {
    static async createComment(req, res) {
        const userId = req.user?.id;
        const { post_id, content, parent_comment_id } = req.body;

        try {
            if (!userId) {
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
                `INSERT INTO comments (post_id, user_id, parent_comment_id, content)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [post_id, userId, parent_comment_id || null, content]
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
                    c.id, c.post_id, c.user_id, c.parent_comment_id, c.content, c.status, c.created_at, c.updated_at,
                    u.name as author_name,
                    up.avatar_url as author_avatar
                FROM comments c
                JOIN users u ON u.id = c.user_id
                LEFT JOIN user_profiles up ON up.user_id = u.id
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
        const userRole = req.user?.role;
        const { comment_id } = req.params;
        try {
            const existing = await pool.query('SELECT id, user_id, status FROM comments WHERE id = $1', [comment_id]);
            if (existing.rows.length === 0) {
                return res.status(404).json({ error: 'Comment not found' });
            }
            const comment = existing.rows[0];
            if (comment.user_id !== userId && userRole !== 'admin') {
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
}

module.exports = CommentController;


