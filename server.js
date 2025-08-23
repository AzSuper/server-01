const dns = require('dns');
dns.setDefaultResultOrder && dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const commentRoutes = require('./routes/commentRoutes');
const { pool, testConnection } = require('./config/db');
const { validateEnvironment } = require('./config/env');
const { globalErrorHandler } = require('./utils/errorHandler');
const { logger, stream } = require('./utils/logger');
const cloudinary = require('cloudinary').v2;

// Load environment variables
require('dotenv').config();

// Validate environment configuration
try {
    validateEnvironment();
} catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    max: 100, // Limit each IP to 100 requests per windowMs
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// Logging middleware
app.use(morgan('combined', { stream }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/comments', commentRoutes);

// 404 handler
app.all('*', (req, res, next) => {
    res.status(404).json({
        status: 'fail',
        message: `Can't find ${req.originalUrl} on this server!`
    });
});

// Global error handling middleware
app.use(globalErrorHandler);

// Test Database Connection
const initializeDatabase = async () => {
    try {
        const isConnected = await testConnection();
        if (isConnected) {
            logger.info('✅ Connected to PostgreSQL database');
        } else {
            logger.error('❌ Database connection failed');
            process.exit(1);
        }
    } catch (error) {
        logger.error('❌ Database connection error:', error);
        process.exit(1);
    }
};

// Start the server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    logger.info(`🚀 Server is running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 Base URL: https://server-final-2olj.onrender.com`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`🔄 Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        logger.info('✅ HTTP server closed');
        
        pool.end(() => {
            logger.info('✅ Database connections closed');
            process.exit(0);
        });
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
        logger.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('❌ Unhandled Rejection:', err);
    server.close(() => {
        process.exit(1);
    });
});

// Initialize database connection
initializeDatabase();