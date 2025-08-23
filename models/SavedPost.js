const { pool } = require('../config/db');

class SavedPost {
    static async savePost(client_id, post_id) {
        const result = await pool.query(
            'INSERT INTO saved_posts (client_id, post_id) VALUES ($1, $2) RETURNING *',
            [client_id, post_id]
        );
        return result.rows[0];
    }

    static async getSavedPostsByClientId(client_id) {
        const result = await pool.query('SELECT * FROM saved_posts WHERE client_id = $1', [client_id]);
        return result.rows;
    }
}

module.exports = SavedPost;
