#!/bin/bash

# Simple Points System Migration Script
# This script applies the points system migration to your database

echo "🚀 Points System Migration Script"
echo "=================================="
echo ""

# Database connection details (update these with your actual details)
DB_HOST="aws-1-eu-west-1.pooler.supabase.com"
DB_PORT="6543"
DB_NAME="postgres"
DB_USER="postgres.ksxnvixndizuczbhijbp"

echo "📋 Database Connection Details:"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client tools."
    echo "   On Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "   On macOS: brew install postgresql"
    echo "   On Windows: Download from https://www.postgresql.org/download/windows/"
    exit 1
fi

# Prompt for password
read -s -p "🔐 Enter your database password: " DB_PASSWORD
echo ""

# Test connection
echo "🔍 Testing database connection..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" &> /dev/null; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed. Please check your credentials."
    exit 1
fi

echo ""
echo "📊 Applying Points System Migration..."
echo ""

# Apply the migration
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f migration_002_points_system_final.sql; then
    echo ""
    echo "🎉 Migration completed successfully!"
    echo ""
    echo "✅ New tables created:"
    echo "   - user_points (user point balances)"
    echo "   - point_transactions (transaction history)"
    echo "   - point_withdrawals (withdrawal requests)"
    echo ""
    echo "✅ New features created:"
    echo "   - Indexes for optimal performance"
    echo "   - Triggers for automatic timestamp updates"
    echo "   - View for easy points overview"
    echo "   - Function for safe points adjustment"
    echo ""
    echo "✅ Sample data inserted (if users/advertisers exist)"
    echo ""
    echo "🚀 Your database is now ready for the points system!"
    echo "   You can start using the admin dashboard points functionality."
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "   - Ensure you have sufficient privileges on the database"
    echo "   - Check that the migration file exists in the current directory"
    echo "   - Verify your database connection details"
    echo "   - Make sure the database is accessible from your current location"
    exit 1
fi

echo ""
echo "📚 Next steps:"
echo "   1. Restart your server to ensure new tables are recognized"
echo "   2. Test the points system in your admin dashboard"
echo "   3. Try adjusting points for a user"
echo "   4. Monitor the points system functionality"
echo ""
echo "🔧 If you need to check the migration status:"
echo "   PGPASSWORD='your_password' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"\\dt user_points\""
echo ""
echo "✨ Migration completed! Happy coding!"
