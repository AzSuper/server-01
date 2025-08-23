const { pool } = require('../config/db');

class Post {
    static async createPost(advertiser_id, category_id, type, title, description, price, old_price, with_reservation, reservation_time, reservation_limit, social_link, media_url) {
        const result = await pool.query(
            'INSERT INTO posts (advertiser_id, category_id, type, title, description, price, old_price, with_reservation, reservation_time, reservation_limit, social_link, media_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
            [advertiser_id, category_id, type, title, description, price, old_price, with_reservation, reservation_time, reservation_limit, social_link, media_url]
        );
        return result.rows[0];
    }

    static async getAllPosts() {
        const result = await pool.query('SELECT * FROM posts');
        return result.rows;
    }

    static async getPostById(id) {
        const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
        return result.rows[0];
    }
}

module.exports = Post;
