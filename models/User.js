const { pool } = require('../config/db');

class User {
    // Create normal user
    static async createNormalUser(fullName, phone, password_hash) {
        const result = await pool.query(
            'INSERT INTO users (full_name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [fullName, phone, password_hash, 'user']
        );
        return result.rows[0];
    }

    // Create advertiser user
    static async createAdvertiser(fullName, phone, password_hash, storeName, description) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Create user
            const userResult = await client.query(
                'INSERT INTO users (full_name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
                [fullName, phone, password_hash, 'advertiser']
            );
            
            const user = userResult.rows[0];
            
            // Create advertiser profile
            const profileResult = await client.query(
                'INSERT INTO advertiser_profiles (user_id, store_name, description) VALUES ($1, $2, $3) RETURNING *',
                [user.id, storeName, description]
            );
            
            await client.query('COMMIT');
            
            return {
                ...user,
                advertiser_profile: profileResult.rows[0]
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Find user by phone
    static async findUserByPhone(phone) {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        return result.rows[0];
    }

    // Find user by email (for backward compatibility)
    static async findUserByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    }

    // Find user by ID
    static async findUserById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    // Get user with advertiser profile
    static async getUserWithProfile(id) {
        const result = await pool.query(`
            SELECT u.*, ap.store_name, ap.description, ap.social_media_links
            FROM users u
            LEFT JOIN advertiser_profiles ap ON u.id = ap.user_id
            WHERE u.id = $1
        `, [id]);
        return result.rows[0];
    }

    // Update user verification status
    static async updateVerificationStatus(id, isVerified) {
        const result = await pool.query(
            'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [isVerified, id]
        );
        return result.rows[0];
    }

    // Update password
    static async updatePassword(id, password_hash) {
        const result = await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [password_hash, id]
        );
        return result.rows[0];
    }

    // Check if phone exists
    static async phoneExists(phone) {
        const result = await pool.query('SELECT COUNT(*) as count FROM users WHERE phone = $1', [phone]);
        return parseInt(result.rows[0].count) > 0;
    }

    // Update advertiser profile
    static async updateAdvertiserProfile(userId, storeName, description, socialMediaLinks) {
        const result = await pool.query(`
            INSERT INTO advertiser_profiles (user_id, store_name, description, social_media_links)
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (user_id) DO UPDATE SET
                store_name = EXCLUDED.store_name,
                description = EXCLUDED.description,
                social_media_links = EXCLUDED.social_media_links,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, storeName, description, socialMediaLinks || null]);
        return result.rows[0];
    }
}

module.exports = User;
