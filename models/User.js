const { pool } = require('../config/db');

class User {
    // Create normal user
    static async createUser(fullName, phone, password_hash, profileImage = null) {
        const result = await pool.query(
            'INSERT INTO users (full_name, phone, password_hash, profile_image) VALUES ($1, $2, $3, $4) RETURNING *',
            [fullName, phone, password_hash, profileImage]
        );
        return result.rows[0];
    }

    // Create advertiser
    static async createAdvertiser(fullName, phone, password_hash, storeName, storeImage, description) {
        const result = await pool.query(
            'INSERT INTO advertisers (full_name, phone, password_hash, store_name, store_image, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [fullName, phone, password_hash, storeName, storeImage, description]
        );
        return result.rows[0];
    }

    // Find user by phone
    static async findUserByPhone(phone) {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        return result.rows[0];
    }

    // Find advertiser by phone
    static async findAdvertiserByPhone(phone) {
        const result = await pool.query('SELECT * FROM advertisers WHERE phone = $1', [phone]);
        return result.rows[0];
    }

    // Find user by ID
    static async findUserById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    // Find advertiser by ID
    static async findAdvertiserById(id) {
        const result = await pool.query('SELECT * FROM advertisers WHERE id = $1', [id]);
        return result.rows[0];
    }

    // Get user with profile
    static async getUserWithProfile(id) {
        const result = await pool.query(`
            SELECT u.*, up.display_name, up.bio, up.website, up.location, up.social_links, up.metadata
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = $1
        `, [id]);
        return result.rows[0];
    }

    // Get advertiser with profile
    static async getAdvertiserWithProfile(id) {
        const result = await pool.query(`
            SELECT a.*, ap.display_name, ap.bio, ap.website, ap.location, ap.social_links, ap.metadata
            FROM advertisers a
            LEFT JOIN advertiser_profiles ap ON a.id = ap.advertiser_id
            WHERE a.id = $1
        `, [id]);
        return result.rows[0];
    }

    // Update user verification status
    static async updateUserVerificationStatus(id, isVerified) {
        const result = await pool.query(
            'UPDATE users SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [isVerified, id]
        );
        return result.rows[0];
    }

    // Update advertiser verification status
    static async updateAdvertiserVerificationStatus(id, isVerified) {
        const result = await pool.query(
            'UPDATE advertisers SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [isVerified, id]
        );
        return result.rows[0];
    }

    // Update user password
    static async updateUserPassword(id, password_hash) {
        const result = await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [password_hash, id]
        );
        return result.rows[0];
    }

    // Update advertiser password
    static async updateAdvertiserPassword(id, password_hash) {
        const result = await pool.query(
            'UPDATE advertisers SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [password_hash, id]
        );
        return result.rows[0];
    }

    // Check if user phone exists
    static async userPhoneExists(phone) {
        const result = await pool.query('SELECT COUNT(*) as count FROM users WHERE phone = $1', [phone]);
        return parseInt(result.rows[0].count) > 0;
    }

    // Check if advertiser phone exists
    static async advertiserPhoneExists(phone) {
        const result = await pool.query('SELECT COUNT(*) as count FROM advertisers WHERE phone = $1', [phone]);
        return parseInt(result.rows[0].count) > 0;
    }

    // Check if any phone exists (for OTP verification)
    static async phoneExists(phone) {
        const userExists = await this.userPhoneExists(phone);
        const advertiserExists = await this.advertiserPhoneExists(phone);
        return userExists || advertiserExists;
    }

    // Update user profile
    static async updateUserProfile(userId, displayName, bio, website, location, socialLinks, metadata) {
        const result = await pool.query(`
            INSERT INTO user_profiles (user_id, display_name, bio, website, location, social_links, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
            ON CONFLICT (user_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                bio = EXCLUDED.bio,
                website = EXCLUDED.website,
                location = EXCLUDED.location,
                social_links = EXCLUDED.social_links,
                metadata = EXCLUDED.metadata,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, displayName, bio, website, location, socialLinks || null, metadata || null]);
        return result.rows[0];
    }

    // Update advertiser profile
    static async updateAdvertiserProfile(advertiserId, displayName, bio, website, location, socialLinks, metadata) {
        const result = await pool.query(`
            INSERT INTO advertiser_profiles (advertiser_id, display_name, bio, website, location, social_links, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
            ON CONFLICT (advertiser_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                bio = EXCLUDED.bio,
                website = EXCLUDED.website,
                location = EXCLUDED.location,
                social_links = EXCLUDED.social_links,
                metadata = EXCLUDED.metadata,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [advertiserId, displayName, bio, website, location, socialLinks || null, metadata || null]);
        return result.rows[0];
    }

    // Get user type by phone (for authentication)
    static async getUserTypeByPhone(phone) {
        const user = await this.findUserByPhone(phone);
        if (user) return { type: 'user', user };
        
        const advertiser = await this.findAdvertiserByPhone(phone);
        if (advertiser) return { type: 'advertiser', user: advertiser };
        
        return null;
    }
}

module.exports = User;
