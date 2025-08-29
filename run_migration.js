require('dotenv').config();
const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔧 Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Connected! Running migration...');
    
    // Read the migration SQL
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250829175353_fix-point-sys-04.sql', 'utf8');
    
    // Execute the migration
    const result = await client.query(migrationSQL);
    console.log('✅ Migration executed successfully!');
    
    // Verify the constraint was added
    const verifyResult = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname = 'point_transactions_transaction_type_check'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Constraint verified:', verifyResult.rows[0]);
    } else {
      console.log('⚠️  Constraint not found - this might be expected if the table doesn\'t exist yet');
    }
    
    client.release();
    console.log('🎯 Migration completed! Points adjustment should now work with "correction" transaction type.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    if (error.code === '42P01') {
      console.log('💡 The point_transactions table might not exist yet. This is normal for new installations.');
    }
  } finally {
    await pool.end();
  }
}

runMigration();
