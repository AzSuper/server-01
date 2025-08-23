class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        Error.captureStackTrace(this, this.constructor);
    }
}

const handleDatabaseError = (error) => {
    if (error.code === '23505') { // Unique violation
        return new AppError('Resource already exists', 409);
    }
    if (error.code === '23503') { // Foreign key violation
        return new AppError('Referenced resource not found', 400);
    }
    if (error.code === '23502') { // Not null violation
        return new AppError('Required field missing', 400);
    }
    if (error.code === '42P01') { // Undefined table
        return new AppError('Database configuration error', 500);
    }
    return new AppError('Database operation failed', 500);
};

const handleValidationError = (error) => {
    const message = Object.values(error.errors).map(val => val.message).join('. ');
    return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    } else {
        // Programming or other unknown error: don't leak error details
        console.error('ERROR 💥', err);
        res.status(500).json({
            status: 'error',
            message: 'Something went wrong!'
        });
    }
};

const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else if (process.env.NODE_ENV === 'production') {
        sendErrorProd(err, res);
    }
};

module.exports = {
    AppError,
    handleDatabaseError,
    handleValidationError,
    handleJWTError,
    handleJWTExpiredError,
    globalErrorHandler
};
