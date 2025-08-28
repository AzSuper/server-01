const jwt = require('jsonwebtoken');
const { AppError, handleJWTError, handleJWTExpiredError } = require('../utils/errorHandler');

const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Access token required', 401));
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return next(new AppError('Access token required', 401));
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                if (err.name === 'JsonWebTokenError') {
                    return next(handleJWTError());
                }
                if (err.name === 'TokenExpiredError') {
                    return next(handleJWTExpiredError());
                }
                return next(new AppError('Invalid token', 401));
            }

            req.user = decoded;
            next();
        });
    } catch (error) {
        next(new AppError('Authentication failed', 401));
    }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (!err) {
                    req.user = decoded;
                }
                next();
            });
        } else {
            next();
        }
    } catch (error) {
        next();
    }
};

// Type-based authorization middleware
const authorizeTypes = (...allowedTypes) => {
    return (req, res, next) => {
        try {
            const userType = req.user?.type;
            if (!userType) {
                return next(new AppError('Unauthorized', 401));
            }
            if (!allowedTypes.includes(userType)) {
                return next(new AppError('Forbidden: insufficient permissions', 403));
            }
            next();
        } catch (error) {
            next(new AppError('Authorization failed', 403));
        }
    };
};

// Ensure the authenticated user matches the target resource owner (by id) or is admin
const requireSelfOrAdmin = (paramName) => {
    return (req, res, next) => {
        try {
            const targetIdRaw = req.params[paramName];
            const targetId = targetIdRaw ? parseInt(targetIdRaw) : undefined;
            if (!req.user?.id) {
                return next(new AppError('Unauthorized', 401));
            }
            // For now, we'll allow users to access their own resources
            // In the future, you can add an admin user type if needed
            if (typeof targetId === 'number' && Number.isFinite(targetId) && req.user.id === targetId) {
                return next();
            }
            return next(new AppError('Forbidden: cannot access this resource', 403));
        } catch (error) {
            next(new AppError('Authorization failed', 403));
        }
    };
};

// Ensure only advertisers can access (for post creation, etc.)
const requireAdvertiser = (req, res, next) => {
    try {
        if (req.user?.type !== 'advertiser') {
            return next(new AppError('Forbidden: only advertisers can access this resource', 403));
        }
        next();
    } catch (error) {
        next(new AppError('Authorization failed', 403));
    }
};

// Ensure only users can access (for certain user-specific features)
const requireUser = (req, res, next) => {
    try {
        if (req.user?.type !== 'user') {
            return next(new AppError('Forbidden: only users can access this resource', 403));
        }
        next();
    } catch (error) {
        next(new AppError('Authorization failed', 403));
    }
};

// Ensure only admins can access
const requireAdmin = (req, res, next) => {
    try {
        if (req.user?.type !== 'admin') {
            return next(new AppError('Forbidden: admin access required', 403));
        }
        next();
    } catch (error) {
        next(new AppError('Authorization failed', 403));
    }
};

module.exports = { 
    authenticateToken, 
    optionalAuth, 
    authorizeTypes, 
    requireSelfOrAdmin, 
    requireAdvertiser, 
    requireUser,
    requireAdmin
};
