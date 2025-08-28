const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const User = require('../models/User');
const OTPService = require('../utils/otpService');

// Step 1: Send OTP for phone verification (user enters all data first)
exports.sendOTP = async (req, res) => {
    const { fullName, phone, password, profileImage, storeName, storeImage, description } = req.body;
    const userType = req.headers['x-user-type']; // Get user type from header

    if (!phone || !userType || !fullName || !password) {
        return res.status(400).json({
            error: 'Phone number, full name, password, and X-User-Type header are required',
            required_fields: ['phone', 'fullName', 'password'],
            required_headers: ['X-User-Type']
        });
    }

    if (!['user', 'advertiser'].includes(userType)) {
        return res.status(400).json({
            error: 'User type must be either "user" or "advertiser"'
        });
    }

    // For advertisers, store name is required
    if (userType === 'advertiser' && !storeName) {
        return res.status(400).json({
            error: 'Store name is required for advertisers',
            required_fields: ['storeName']
        });
    }

    try {
        // Check if user already exists (this is for registration only)
        let userExists = false;
        if (userType === 'user') {
            userExists = await User.userPhoneExists(phone);
        } else {
            userExists = await User.advertiserPhoneExists(phone);
        }
        
        if (userExists) {
            return res.status(409).json({ 
                error: `${userType} already exists with this phone number` 
            });
        }

        // Store user data temporarily (in production, you might use Redis or session)
        // For now, we'll store it in the request body and pass it to the next step
        const userData = {
            fullName,
            phone,
            password,
            profileImage,
            storeName,
            storeImage,
            description,
            userType
        };
        
        // Store user data in a simple in-memory storage (in production, use Redis)
        // This is just for demonstration - in real app, use proper session storage
        if (!global.tempUserData) global.tempUserData = {};
        global.tempUserData[phone] = {
            ...userData,
            expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
        };

        // Create OTP (always for verification since this is the registration endpoint)
        const otpRecord = await OTPService.createOTP(phone, 'verification', userType, 10); // 10 minutes expiry

        // In a real application, you would send this OTP via SMS
        // For development/testing, we'll return it in the response
        res.json({
            message: 'OTP sent successfully',
            otp: process.env.NODE_ENV === 'development' ? otpRecord.otp_code : undefined,
            expires_in: '10 minutes',
            phone: phone,
            userType: userType,
            userData: userData // Include user data for the next step
        });
    } catch (error) {
        logger.error('Error sending OTP:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};

// Step 2: Verify OTP and create account (only OTP needed)
exports.verifyOTP = async (req, res) => {
    const { otp } = req.body;
    const userType = req.headers['x-user-type']; // Get user type from header
    const phone = req.headers['x-phone']; // Get phone from header

    if (!otp || !userType || !phone) {
        return res.status(400).json({
            error: 'OTP, X-User-Type header, and X-Phone header are required',
            required_fields: ['otp'],
            required_headers: ['X-User-Type', 'X-Phone']
        });
    }

    try {
        // Verify OTP (always for verification since this is the registration endpoint)
        const otpVerification = await OTPService.verifyOTP(phone, otp, 'verification', userType);
        
        if (!otpVerification.isValid) {
            return res.status(400).json({
                message: 'OTP verification failed',
                verified: false,
                error: otpVerification.message
            });
        }

        // OTP is verified, now create the account
        // Get the user data from temporary storage
        if (!global.tempUserData || !global.tempUserData[phone]) {
            return res.status(400).json({
                error: 'User data not found or expired. Please send OTP again.',
                required_fields: ['phone']
            });
        }
        
        const userData = global.tempUserData[phone];
        
        // Check if data is expired
        if (Date.now() > userData.expiresAt) {
            delete global.tempUserData[phone];
            return res.status(400).json({
                error: 'User data expired. Please send OTP again.',
                required_fields: ['phone']
            });
        }
        
        const { fullName, password, profileImage, storeName, storeImage, description } = userData;

        // For advertisers, store name is required
        if (userType === 'advertiser' && !storeName) {
            return res.status(400).json({
                error: 'Store name is required for advertisers',
                required_fields: ['storeName']
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        let user, token;

        if (userType === 'user') {
            // Create user
            user = await User.createUser(fullName, phone, hashedPassword, profileImage);
            // Mark user as verified
            await User.updateUserVerificationStatus(user.id, true);
            // Generate JWT
            token = jwt.sign(
                { id: user.id, type: 'user', phone: user.phone },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
        } else {
            // Create advertiser
            user = await User.createAdvertiser(fullName, phone, hashedPassword, storeName, storeImage, description);
            // Mark advertiser as verified
            await User.updateAdvertiserVerificationStatus(user.id, true);
            // Generate JWT
            token = jwt.sign(
                { id: user.id, type: 'advertiser', phone: user.phone },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
        }

        // Clean up temporary data after successful account creation
        delete global.tempUserData[phone];
        
        res.status(201).json({
            message: `${userType} registered successfully`,
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                type: userType,
                is_verified: true,
                profile_image: user.profile_image,
                store_name: user.store_name,
                store_image: user.store_image,
                description: user.description
            },
            token
        });
    } catch (error) {
        logger.error('Error verifying OTP:', error);
        res.status(500).json({ error: 'OTP verification failed' });
    }
};

// Login for both user types
exports.login = async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({
            error: 'Phone number and password are required',
            required_fields: ['phone', 'password']
        });
    }

    try {
        // Check if user exists and get their type
        const userTypeInfo = await User.getUserTypeByPhone(phone);
        
        if (!userTypeInfo) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const { type, user } = userTypeInfo;

        if (!user.is_verified) {
            return res.status(401).json({ 
                error: 'Account not verified. Please verify your phone number first.' 
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, type: type, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Get user with profile
        let userWithProfile = user;
        if (type === 'user') {
            userWithProfile = await User.getUserWithProfile(user.id);
        } else {
            userWithProfile = await User.getAdvertiserWithProfile(user.id);
        }

        res.json({
            message: 'Login successful',
            user: {
                id: userWithProfile.id,
                full_name: userWithProfile.full_name,
                phone: userWithProfile.phone,
                type: type,
                is_verified: userWithProfile.is_verified,
                profile_image: userWithProfile.profile_image,
                store_name: userWithProfile.store_name,
                store_image: userWithProfile.store_image,
                description: userWithProfile.description
            },
            token
        });
    } catch (error) {
        logger.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Forgot password - send OTP
exports.forgotPassword = async (req, res) => {
    const { phone } = req.body;
    const userType = req.headers['x-user-type']; // Get user type from header

    if (!phone || !userType) {
        return res.status(400).json({
            error: 'Phone number and X-User-Type header are required',
            required_fields: ['phone'],
            required_headers: ['X-User-Type']
        });
    }

    if (!['user', 'advertiser'].includes(userType)) {
        return res.status(400).json({
            error: 'X-User-Type header must be either "user" or "advertiser"'
        });
    }

    try {
        // Check if user exists
        let userExists = false;
        if (userType === 'user') {
            userExists = await User.userPhoneExists(phone);
        } else {
            userExists = await User.advertiserPhoneExists(phone);
        }
        
        if (!userExists) {
            return res.status(404).json({ 
                error: `${userType} not found with this phone number` 
            });
        }

        // Send OTP for password reset
        const otpRecord = await OTPService.createOTP(phone, 'password_reset', userType, 10);

        res.json({
            message: 'Password reset OTP sent successfully',
            otp: process.env.NODE_ENV === 'development' ? otpRecord.otp_code : undefined,
            expires_in: '10 minutes',
            phone: phone,
            userType: userType
        });
    } catch (error) {
        logger.error('Error in forgot password:', error);
        res.status(500).json({ error: 'Failed to send password reset OTP' });
    }
};

// Reset password with OTP
exports.resetPassword = async (req, res) => {
    const { otp, newPassword } = req.body;
    const userType = req.headers['x-user-type']; // Get user type from header
    const phone = req.headers['x-phone']; // Get phone from header

    if (!phone || !otp || !newPassword || !userType) {
        return res.status(400).json({
            error: 'OTP, new password, X-User-Type header, and X-Phone header are required',
            required_fields: ['otp', 'newPassword'],
            required_headers: ['X-User-Type', 'X-Phone']
        });
    }

    try {
        // Verify OTP
        const otpVerification = await OTPService.verifyOTP(phone, otp, 'password_reset', userType);
        if (!otpVerification.isValid) {
            return res.status(400).json({ error: otpVerification.message });
        }

        // Find user
        let user = null;
        if (userType === 'user') {
            user = await User.findUserByPhone(phone);
        } else {
            user = await User.findAdvertiserByPhone(phone);
        }
        
        if (!user) {
            return res.status(404).json({ error: `${userType} not found` });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        if (userType === 'user') {
            await User.updateUserPassword(user.id, hashedPassword);
        } else {
            await User.updateAdvertiserPassword(user.id, hashedPassword);
        }

        res.json({
            message: 'Password reset successfully'
        });
    } catch (error) {
        logger.error('Error resetting password:', error);
        res.status(500).json({ error: 'Password reset failed' });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.type;

    try {
        let user = null;
        if (userType === 'user') {
            user = await User.getUserWithProfile(userId);
        } else {
            user = await User.getAdvertiserWithProfile(userId);
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                type: userType,
                is_verified: user.is_verified,
                profile_image: user.profile_image,
                store_name: user.store_name,
                store_image: user.store_image,
                description: user.description,
                display_name: user.display_name,
                bio: user.bio,
                website: user.website,
                location: user.location,
                social_links: user.social_links,
                metadata: user.metadata
            }
        });
    } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.type;
    const { displayName, bio, website, location, socialLinks, metadata } = req.body;

    try {
        let profile = null;
        if (userType === 'user') {
            profile = await User.updateUserProfile(userId, displayName, bio, website, location, socialLinks, metadata);
        } else {
            profile = await User.updateAdvertiserProfile(userId, displayName, bio, website, location, socialLinks, metadata);
        }

        res.json({
            message: 'Profile updated successfully',
            profile
        });
    } catch (error) {
        logger.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Get user by ID (admin only)
exports.getUserById = async (req, res) => {
    const { id } = req.params;
    const { userType } = req.query;

    if (!userType || !['user', 'advertiser'].includes(userType)) {
        return res.status(400).json({
            error: 'User type query parameter is required and must be "user" or "advertiser"'
        });
    }

    try {
        let user = null;
        if (userType === 'user') {
            user = await User.getUserWithProfile(id);
        } else {
            user = await User.getAdvertiserWithProfile(id);
        }
        
        if (!user) {
            return res.status(404).json({ error: `${userType} not found` });
        }

        res.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                type: userType,
                is_verified: user.is_verified,
                profile_image: user.profile_image,
                store_name: user.store_name,
                store_image: user.store_image,
                description: user.description,
                display_name: user.display_name,
                bio: user.bio,
                website: user.website,
                location: user.location,
                social_links: user.social_links,
                metadata: user.metadata
            }
        });
    } catch (error) {
        logger.error('Error getting user by ID:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
};

// Cleanup expired OTPs (can be called periodically)
exports.cleanupOTPs = async (req, res) => {
    try {
        await OTPService.cleanupExpiredOTPs();
        res.json({ message: 'OTP cleanup completed' });
    } catch (error) {
        logger.error('Error cleaning up OTPs:', error);
        res.status(500).json({ error: 'OTP cleanup failed' });
    }
};

// Get latest OTP for testing (development only)
exports.getLatestOTP = async (req, res) => {
    try {
        const { phone, type } = req.params;
        const userType = req.headers['x-user-type']; // Get user type from header
        
        if (!phone || !type || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Phone number, OTP type, and X-User-Type header are required'
            });
        }

        const otpInfo = await OTPService.getLatestOTP(phone, type, userType);
        
        if (otpInfo.error) {
            return res.status(404).json({
                success: false,
                message: otpInfo.error
            });
        }

        res.json({
            success: true,
            message: 'OTP retrieved successfully (development only)',
            data: otpInfo
        });
    } catch (error) {
        logger.error('Error getting latest OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all users (public - for dashboard display)
exports.getAllUsersPublic = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', verified } = req.query;
        
        // Parse and validate parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
        const searchTerm = search || '';
        const verifiedFilter = verified === 'true' ? true : verified === 'false' ? false : null;

        const result = await User.getAllUsers(pageNum, limitNum, searchTerm, verifiedFilter);

        res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: result.users,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error getting all users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users'
        });
    }
};

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', verified } = req.query;
        
        // Parse and validate parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
        const searchTerm = search || '';
        const verifiedFilter = verified === 'true' ? true : verified === 'false' ? false : null;

        const result = await User.getAllUsers(pageNum, limitNum, searchTerm, verifiedFilter);

        res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: result.users,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error getting all users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users'
        });
    }
};

// Get all advertisers (admin only)
exports.getAllAdvertisers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', verified } = req.query;
        
        // Parse and validate parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
        const searchTerm = search || '';
        const verifiedFilter = verified === 'true' ? true : verified === 'false' ? false : null;

        const result = await User.getAllAdvertisers(pageNum, limitNum, searchTerm, verifiedFilter);

        res.json({
            success: true,
            message: 'Advertisers retrieved successfully',
            data: result.advertisers,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error getting all advertisers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve advertisers'
        });
    }
};

// Get all users and advertisers combined (admin only)
exports.getAllUsersCombined = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', userType, verified } = req.query;
        
        // Parse and validate parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
        const searchTerm = search || '';
        const userTypeFilter = userType && ['user', 'advertiser'].includes(userType) ? userType : null;
        const verifiedFilter = verified === 'true' ? true : verified === 'false' ? false : null;

        const result = await User.getAllUsersCombined(pageNum, limitNum, searchTerm, userTypeFilter, verifiedFilter);

        res.json({
            success: true,
            message: 'Users and advertisers retrieved successfully',
            data: result.users,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error getting all users combined:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users and advertisers'
        });
    }
};

// Update user verification status (admin only)
exports.updateUserVerificationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isVerified, userType } = req.body;

        if (typeof isVerified !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isVerified must be a boolean value'
            });
        }

        if (!userType || !['user', 'advertiser'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'userType must be either "user" or "advertiser"'
            });
        }

        let updatedUser;
        if (userType === 'user') {
            updatedUser = await User.updateUserVerificationStatus(id, isVerified);
        } else {
            updatedUser = await User.updateAdvertiserVerificationStatus(id, isVerified);
        }

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: `${userType} not found`
            });
        }

        res.json({
            success: true,
            message: `${userType} verification status updated successfully`,
            data: {
                id: updatedUser.id,
                is_verified: updatedUser.is_verified,
                updated_at: updatedUser.updated_at
            }
        });
    } catch (error) {
        logger.error('Error updating user verification status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update verification status'
        });
    }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { userType } = req.body;

        if (!userType || !['user', 'advertiser'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'userType must be either "user" or "advertiser"'
            });
        }

        let deletedUser;
        if (userType === 'user') {
            // Delete user profiles first (due to foreign key constraints)
            await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [id]);
            await pool.query('DELETE FROM user_settings WHERE user_id = $1 AND user_type = $2', [id, userType]);
            
            // Delete user points if they exist
            await pool.query('DELETE FROM user_points WHERE user_id = $1 AND user_type = $2', [id, userType]);
            
            // Delete the user
            const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
            deletedUser = result.rows[0];
        } else {
            // Delete advertiser profiles first
            await pool.query('DELETE FROM advertiser_profiles WHERE advertiser_id = $1', [id]);
            await pool.query('DELETE FROM user_settings WHERE user_id = $1 AND user_type = $2', [id, userType]);
            
            // Delete advertiser points if they exist
            await pool.query('DELETE FROM user_points WHERE user_id = $1 AND user_type = $2', [id, userType]);
            
            // Delete the advertiser
            const result = await pool.query('DELETE FROM advertisers WHERE id = $1 RETURNING *', [id]);
            deletedUser = result.rows[0];
        }

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: `${userType} not found`
            });
        }

        res.json({
            success: true,
            message: `${userType} deleted successfully`,
            data: {
                id: deletedUser.id,
                full_name: deletedUser.full_name,
                phone: deletedUser.phone
            }
        });
    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
};
