const requiredEnvVars = [
    // When DATABASE_URL is provided, individual DB_* vars are optional
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];

const validateEnvironment = () => {
    const missing = [];
    
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    // Database variables validation
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const hasDiscreteDbVars = ['DB_USER','DB_HOST','DB_NAME','DB_PASSWORD','DB_PORT']
        .every((key) => !!process.env[key]);
    if (!hasDatabaseUrl && !hasDiscreteDbVars) {
        missing.push('DATABASE_URL (or all of DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT)');
    }
    
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Validate JWT_SECRET length
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    
    // Validate database port only when discrete vars are used
    if (!hasDatabaseUrl) {
        const dbPort = parseInt(process.env.DB_PORT);
        if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
            throw new Error('DB_PORT must be a valid port number (1-65535)');
        }
    }
    
    console.log('✅ Environment configuration validated successfully');
};

module.exports = { validateEnvironment };
