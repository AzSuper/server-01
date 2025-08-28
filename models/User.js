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

    // Get all users with pagination and filtering
    static async getAllUsers(page = 1, limit = 20, search = '', verified = null) {
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE 1=1';
        let params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereClause += ` AND (u.full_name ILIKE $${paramCount} OR u.phone ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (verified !== null) {
            paramCount++;
            whereClause += ` AND u.is_verified = $${paramCount}`;
            params.push(verified);
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Get users with profiles
        paramCount++;
        const usersQuery = `
            SELECT 
                u.id,
                u.full_name,
                u.phone,
                u.profile_image,
                u.is_verified,
                u.created_at,
                u.updated_at,
                up.display_name,
                up.bio,
                up.website,
                up.location,
                up.social_links,
                up.metadata
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(limit, offset);
        
        const usersResult = await pool.query(usersQuery, params);
        const users = usersResult.rows;

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }

    // Get all advertisers with pagination and filtering
    static async getAllAdvertisers(page = 1, limit = 20, search = '', verified = null) {
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE 1=1';
        let params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereClause += ` AND (a.full_name ILIKE $${paramCount} OR a.store_name ILIKE $${paramCount} OR a.phone ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (verified !== null) {
            paramCount++;
            whereClause += ` AND a.is_verified = $${paramCount}`;
            params.push(verified);
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM advertisers a
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Get advertisers with profiles
        paramCount++;
        const advertisersQuery = `
            SELECT 
                a.id,
                a.full_name,
                a.phone,
                a.store_name,
                a.store_image,
                a.description,
                a.is_verified,
                a.created_at,
                a.updated_at,
                ap.display_name,
                ap.bio,
                ap.website,
                ap.location,
                ap.social_links,
                ap.metadata
            FROM advertisers a
            LEFT JOIN advertiser_profiles ap ON a.id = ap.advertiser_id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(limit, offset);
        
        const advertisersResult = await pool.query(advertisersQuery, params);
        const advertisers = advertisersResult.rows;

        return {
            advertisers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }

    // Get all users and advertisers combined (for admin dashboard)
    static async getAllUsersCombined(page = 1, limit = 20, search = '', userType = null, verified = null) {
        const offset = (page - 1) * limit;
        
        let whereClause = '';
        let params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereClause += ` AND (full_name ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (userType) {
            paramCount++;
            whereClause += ` AND user_type = $${paramCount}`;
            params.push(userType);
        }

        if (verified !== null) {
            paramCount++;
            whereClause += ` AND is_verified = $${paramCount}`;
            params.push(verified);
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                SELECT u.id, u.full_name, u.phone, u.is_verified, 'user' as user_type
                FROM users u
                UNION ALL
                SELECT a.id, a.full_name, a.phone, a.is_verified, 'advertiser' as user_type
                FROM advertisers a
            ) combined
            WHERE 1=1 ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Get combined users and advertisers
        paramCount++;
        const combinedQuery = `
            SELECT * FROM (
                SELECT 
                    u.id,
                    u.full_name,
                    u.phone,
                    u.profile_image as avatar,
                    u.is_verified,
                    u.created_at,
                    u.updated_at,
                    'user' as user_type,
                    NULL as store_name,
                    NULL as store_image,
                    NULL as description,
                    up.display_name,
                    up.bio,
                    up.website,
                    up.location,
                    up.social_links,
                    up.metadata
                FROM users u
                LEFT JOIN user_profiles up ON u.id = up.user_id
                
                UNION ALL
                
                SELECT 
                    a.id,
                    a.full_name,
                    a.phone,
                    a.store_image as avatar,
                    a.is_verified,
                    a.created_at,
                    a.updated_at,
                    'advertiser' as user_type,
                    a.store_name,
                    a.store_image,
                    a.description,
                    ap.display_name,
                    ap.bio,
                    ap.website,
                    ap.location,
                    ap.social_links,
                    ap.metadata
                FROM advertisers a
                LEFT JOIN advertiser_profiles ap ON a.id = ap.advertiser_id
            ) combined
            WHERE 1=1 ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(limit, offset);
        
        const combinedResult = await pool.query(combinedQuery, params);
        const users = combinedResult.rows;

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
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
