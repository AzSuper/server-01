const { pool } = require('../config/db');
const { logger } = require('./logger');

class OTPService {
    // Generate a 6-digit OTP
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Create OTP record in database
    static async createOTP(phone, type, userType, expiresInMinutes = 10) {
        const otp = this.generateOTP();
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

        try {
            // Delete any existing unused OTPs for this phone, type, and user type
            await pool.query(
                'DELETE FROM otp_codes WHERE phone = $1 AND type = $2 AND user_type = $3 AND is_used = false',
                [phone, type, userType]
            );

            // Insert new OTP
            const result = await pool.query(
                'INSERT INTO otp_codes (phone, otp_code, type, user_type, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [phone, otp, type, userType, expiresAt]
            );

            logger.info(`OTP created for phone ${phone}, type: ${type}, user_type: ${userType}, OTP: ${otp}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating OTP:', error);
            throw error;
        }
    }

    // Verify OTP
    static async verifyOTP(phone, otp, type, userType) {
        try {
            const result = await pool.query(
                'SELECT * FROM otp_codes WHERE phone = $1 AND otp_code = $2 AND type = $3 AND user_type = $4 AND is_used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
                [phone, otp, type, userType]
            );

            if (result.rows.length === 0) {
                return { isValid: false, message: 'Invalid or expired OTP' };
            }

            const otpRecord = result.rows[0];

            // Mark OTP as used
            await pool.query(
                'UPDATE otp_codes SET is_used = true WHERE id = $1',
                [otpRecord.id]
            );

            logger.info(`OTP verified for phone ${phone}, type: ${type}, user_type: ${userType}`);
            return { isValid: true, message: 'OTP verified successfully' };
        } catch (error) {
            logger.error('Error verifying OTP:', error);
            throw error;
        }
    }

    // Clean up expired OTPs
    static async cleanupExpiredOTPs() {
        try {
            const result = await pool.query(
                'DELETE FROM otp_codes WHERE expires_at < NOW() OR is_used = true'
            );
            
            if (result.rowCount > 0) {
                logger.info(`Cleaned up ${result.rowCount} expired/used OTPs`);
            }
        } catch (error) {
            logger.error('Error cleaning up expired OTPs:', error);
        }
    }

    // Get OTP info (for debugging/testing)
    static async getOTPInfo(phone, type, userType) {
        try {
            const result = await pool.query(
                'SELECT * FROM otp_codes WHERE phone = $1 AND type = $2 AND user_type = $3 ORDER BY created_at DESC LIMIT 1',
                [phone, type, userType]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting OTP info:', error);
            throw error;
        }
    }

    // Get latest OTP for testing (development only)
    static async getLatestOTP(phone, type, userType) {
        try {
            const result = await pool.query(
                'SELECT otp_code, created_at, expires_at, is_used FROM otp_codes WHERE phone = $1 AND type = $2 AND user_type = $3 ORDER BY created_at DESC LIMIT 1',
                [phone, type, userType]
            );
            
            if (result.rows.length === 0) {
                return { error: 'No OTP found for this phone, type, and user type' };
            }
            
            const otpRecord = result.rows[0];
            return {
                otp: otpRecord.otp_code,
                created_at: otpRecord.created_at,
                expires_at: otpRecord.expires_at,
                is_used: otpRecord.is_used,
                is_expired: new Date() > new Date(otpRecord.expires_at)
            };
        } catch (error) {
            logger.error('Error getting latest OTP:', error);
            throw error;
        }
    }

    // Check if OTP exists and is valid (for step-by-step flow)
    static async checkOTPExists(phone, type, userType) {
        try {
            const result = await pool.query(
                'SELECT * FROM otp_codes WHERE phone = $1 AND type = $2 AND user_type = $3 AND is_used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
                [phone, type, userType]
            );
            
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error checking OTP existence:', error);
            return false;
        }
    }
}

module.exports = OTPService;
