const multer = require('multer');

// Create multer instance for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to handle both 'media' and 'video' field names
const flexibleUpload = (fieldName = 'media') => {
    return (req, res, next) => {
        // First try to get file from the specified field
        if (req.files && req.files[fieldName]) {
            req.file = req.files[fieldName];
            return next();
        }
        
        // If not found, try to get from 'video' field (for mobile app compatibility)
        if (req.files && req.files.video) {
            req.file = req.files.video;
            return next();
        }
        
        // If still not found, try to get from 'media' field (for backward compatibility)
        if (req.files && req.files.media) {
            req.file = req.files.media;
            return next();
        }
        
        // If no file found, continue (validation will handle the error)
        next();
    };
};

// Export both the original multer instance and the flexible middleware
module.exports = {
    upload,
    flexibleUpload,
    // Single file upload that supports both field names
    singleFile: upload.fields([
        { name: 'media', maxCount: 1 },
        { name: 'video', maxCount: 1 }
    ])
};
