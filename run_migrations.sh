#!/bin/bash

# Database Migration Script
# This script will run all necessary migrations to set up the complete system

echo "🚀 Starting Database Migrations..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed or not in PATH"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Database connection parameters
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"flutter_backend"}
DB_USER=${DB_USER:-"postgres"}

echo "📊 Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo "👤 User: $DB_USER"

# Function to run SQL file
run_sql_file() {
    local file=$1
    local description=$2
    
    echo "🔄 Running: $description"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"; then
        echo "✅ Success: $description"
    else
        echo "❌ Error: Failed to run $description"
        exit 1
    fi
}

# Function to run migration
run_migration() {
    local file=$1
    local description=$2
    
    echo "🔄 Running Migration: $description"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"; then
        echo "✅ Success: Migration $description"
    else
        echo "❌ Error: Failed to run migration $description"
        exit 1
    fi
}

# 1. Run main schema
echo ""
echo "📋 Step 1: Creating main database schema..."
run_sql_file "database/schema.sql" "Main database schema"

# 2. Run points system migration
echo ""
echo "💰 Step 2: Setting up points system..."
run_migration "database/migration_001_points_system.sql" "Points system tables and functions"

# 3. Run admin dashboard migration
echo ""
echo "🔐 Step 3: Setting up admin dashboard..."
run_migration "supabase/migrations/20250828121315_migration-02.sql" "Admin dashboard and enhancements"

# 4. Update admin password
echo ""
echo "🔑 Step 4: Updating admin credentials..."
run_migration "supabase/migrations/20250828133323_migration-03.sql" "Admin password update"

echo ""
echo "🎉 All migrations completed successfully!"
echo ""
echo "📋 System Status:"
echo "✅ Database schema created"
echo "✅ Points system implemented"
echo "✅ Admin dashboard configured"
echo "✅ Admin user created (admin/admin123)"
echo ""
echo "🚀 You can now:"
echo "1. Start the backend server: npm start"
echo "2. Start the dashboard: cd Dasboard && npm run dev"
echo "3. Login to dashboard with: admin / admin123"
echo ""
echo "🔗 Dashboard will be available at: http://localhost:3000"
echo "🔗 Backend API will be available at: http://localhost:5000"
