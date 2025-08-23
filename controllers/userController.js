const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const User = require('../models/User');
const OTPService = require('../utils/otpService');

// Send OTP for phone verification
exports.sendOTP = async (req, res) => {
    const { phone, type } = req.body;

    if (!phone || !type) {
        return res.status(400).json({
            error: 'Phone number and type are required',
            required_fields: ['phone', 'type']
        });
    }

    if (!['verification', 'password_reset'].includes(type)) {
        return res.status(400).json({
            error: 'Type must be either "verification" or "password_reset"'
        });
    }

    try {
        // For password reset, check if user exists
        if (type === 'password_reset') {
            const userExists = await User.phoneExists(phone);
            if (!userExists) {
                return res.status(404).json({ error: 'User not found with this phone number' });
            }
        }

        // For verification, check if user already exists
        if (type === 'verification') {
            const userExists = await User.phoneExists(phone);
            if (userExists) {
                return res.status(409).json({ error: 'User already exists with this phone number' });
            }
        }

        // Create OTP
        const otpRecord = await OTPService.createOTP(phone, type, 10); // 10 minutes expiry

        // In a real application, you would send this OTP via SMS
        // For development/testing, we'll return it in the response
        res.json({
            message: 'OTP sent successfully',
            otp: process.env.NODE_ENV === 'development' ? otpRecord.otp_code : undefined,
            expires_in: '10 minutes'
        });
    } catch (error) {
        logger.error('Error sending OTP:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};

// Verify OTP and register normal user
exports.verifyOTPAndRegisterNormalUser = async (req, res) => {
    const { fullName, phone, password, otp } = req.body;

    if (!fullName || !phone || !password || !otp) {
        return res.status(400).json({
            error: 'All fields are required',
            required_fields: ['fullName', 'phone', 'password', 'otp']
        });
    }

    try {
        // Verify OTP
        const otpVerification = await OTPService.verifyOTP(phone, otp, 'verification');
        if (!otpVerification.isValid) {
            return res.status(400).json({ error: otpVerification.message });
        }

        // Check if user already exists
        const existingUser = await User.findUserByPhone(phone);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this phone number' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.createNormalUser(fullName, phone, hashedPassword);

        // Mark user as verified
        await User.updateVerificationStatus(user.id, true);

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                role: user.role,
                is_verified: true
            },
            token
        });
    } catch (error) {
        logger.error('Error registering normal user:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Verify OTP and register advertiser
exports.verifyOTPAndRegisterAdvertiser = async (req, res) => {
    const { fullName, phone, password, storeName, description, otp } = req.body;

    if (!fullName || !phone || !password || !storeName || !otp) {
        return res.status(400).json({
            error: 'All fields are required',
            required_fields: ['fullName', 'phone', 'password', 'storeName', 'otp']
        });
    }

    try {
        // Verify OTP
        const otpVerification = await OTPService.verifyOTP(phone, otp, 'verification');
        if (!otpVerification.isValid) {
            return res.status(400).json({ error: otpVerification.message });
        }

        // Check if user already exists
        const existingUser = await User.findUserByPhone(phone);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this phone number' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create advertiser with profile
        const advertiser = await User.createAdvertiser(fullName, phone, hashedPassword, storeName, description);

        // Mark user as verified
        await User.updateVerificationStatus(advertiser.id, true);

        // Generate JWT
        const token = jwt.sign(
            { id: advertiser.id, role: advertiser.role, phone: advertiser.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Advertiser registered successfully',
            user: {
                id: advertiser.id,
                full_name: advertiser.full_name,
                phone: advertiser.phone,
                role: advertiser.role,
                is_verified: true,
                advertiser_profile: advertiser.advertiser_profile
            },
            token
        });
    } catch (error) {
        logger.error('Error registering advertiser:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Login with phone and password
exports.loginUser = async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({
            error: 'Phone number and password are required',
            required_fields: ['phone', 'password']
        });
    }

    try {
        const user = await User.findUserByPhone(phone);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_verified) {
            return res.status(401).json({ error: 'Account not verified. Please verify your phone number first.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Get user with profile if advertiser
        let userWithProfile = user;
        if (user.role === 'advertiser') {
            userWithProfile = await User.getUserWithProfile(user.id);
        }

        res.json({
            message: 'Login successful',
            user: {
                id: userWithProfile.id,
                full_name: userWithProfile.full_name,
                phone: userWithProfile.phone,
                role: userWithProfile.role,
                is_verified: userWithProfile.is_verified,
                store_name: userWithProfile.store_name,
                description: userWithProfile.description,
                social_media_links: userWithProfile.social_media_links
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

    if (!phone) {
        return res.status(400).json({
            error: 'Phone number is required',
            required_fields: ['phone']
        });
    }

    try {
        // Check if user exists
        const userExists = await User.phoneExists(phone);
        if (!userExists) {
            return res.status(404).json({ error: 'User not found with this phone number' });
        }

        // Send OTP for password reset
        const otpRecord = await OTPService.createOTP(phone, 'password_reset', 10);

        res.json({
            message: 'Password reset OTP sent successfully',
            otp: process.env.NODE_ENV === 'development' ? otpRecord.otp_code : undefined,
            expires_in: '10 minutes'
        });
    } catch (error) {
        logger.error('Error in forgot password:', error);
        res.status(500).json({ error: 'Failed to send password reset OTP' });
    }
};

// Reset password with OTP
exports.resetPassword = async (req, res) => {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
        return res.status(400).json({
            error: 'All fields are required',
            required_fields: ['phone', 'otp', 'newPassword']
        });
    }

    try {
        // Verify OTP
        const otpVerification = await OTPService.verifyOTP(phone, otp, 'password_reset');
        if (!otpVerification.isValid) {
            return res.status(400).json({ error: otpVerification.message });
        }

        // Find user
        const user = await User.findUserByPhone(phone);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await User.updatePassword(user.id, hashedPassword);

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

    try {
        const user = await User.getUserWithProfile(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                role: user.role,
                is_verified: user.is_verified,
                store_name: user.store_name,
                description: user.description,
                social_media_links: user.social_media_links
            }
        });
    } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
};

// Update advertiser profile
exports.updateAdvertiserProfile = async (req, res) => {
    const userId = req.user.id;
    const { storeName, description, socialMediaLinks } = req.body;

    if (req.user.role !== 'advertiser') {
        return res.status(403).json({ error: 'Only advertisers can update advertiser profile' });
    }

    try {
        const profile = await User.updateAdvertiserProfile(userId, storeName, description, socialMediaLinks);

        res.json({
            message: 'Profile updated successfully',
            profile
        });
    } catch (error) {
        logger.error('Error updating advertiser profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Get user by ID (admin only)
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.getUserWithProfile(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                role: user.role,
                is_verified: user.is_verified,
                store_name: user.store_name,
                description: user.description,
                social_media_links: user.social_media_links
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
        
        if (!phone || !type) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP type are required'
            });
        }

        const otpInfo = await OTPService.getLatestOTP(phone, type);
        
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
