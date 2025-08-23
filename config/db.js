const { Pool } = require('pg');
require('dotenv').config();

// Support either individual DB_* variables or a single DATABASE_URL connection string
const useConnectionString = !!process.env.DATABASE_URL;

const pool = new Pool(
    useConnectionString
        ? {
              connectionString: process.env.DATABASE_URL,
              // Supabase and most managed Postgres require SSL
              ssl: { rejectUnauthorized: false },
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 5000,
              maxUses: 7500,
          }
        : {
              user: process.env.DB_USER,
              host: process.env.DB_HOST,
              database: process.env.DB_NAME,
              password: process.env.DB_PASSWORD,
              port: process.env.DB_PORT,
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 5000,
              maxUses: 7500,
          }
);

// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Test connection function
const testConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        return true;
    } catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
};

module.exports = { pool, testConnection };
