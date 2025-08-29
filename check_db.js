require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔧 Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Connected! Checking database structure...');
    
    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check if point_transactions table exists
    const pointTableExists = tablesResult.rows.some(row => row.table_name === 'point_transactions');
    
    if (pointTableExists) {
      console.log('\n✅ point_transactions table exists!');
      
      // Check the current constraint
      const constraintResult = await client.query(`
        SELECT conname, pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conname = 'point_transactions_transaction_type_check'
      `);
      
      if (constraintResult.rows.length > 0) {
        console.log('🔒 Current constraint:', constraintResult.rows[0]);
      } else {
        console.log('⚠️  No transaction_type constraint found');
      }
      
      // Check table structure
      const structureResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'point_transactions'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📊 point_transactions table structure:');
      structureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
    } else {
      console.log('\n❌ point_transactions table does not exist');
      console.log('💡 You need to run the points system setup first');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

checkDatabase();
