#!/bin/bash

# Migration Application Script for Points System
# This script helps you apply the database migration safely

echo "🚀 Points System Migration Script"
echo "=================================="
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Database connection details
echo "📋 Database Connection Details:"
echo "Host: aws-1-eu-west-1.pooler.supabase.com"
echo "Port: 6543"
echo "Database: postgres"
echo "User: postgres.ksxnvixndizuczbhijbp"
echo ""

# Prompt for password
read -s -p "🔐 Enter your database password: " DB_PASSWORD
echo ""

# Test connection
echo "🔍 Testing database connection..."
if PGPASSWORD="$DB_PASSWORD" psql -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U postgres.ksxnvixndizuczbhijbp -d postgres -c "SELECT version();" &> /dev/null; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed. Please check your credentials."
    exit 1
fi

echo ""
echo "📊 Applying Points System Migration..."
echo ""

# Apply the migration
if PGPASSWORD="$DB_PASSWORD" psql -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U postgres.ksxnvixndizuczbhijbp -d postgres -f migration_001_points_system.sql; then
    echo ""
    echo "🎉 Migration completed successfully!"
    echo ""
    echo "✅ New tables created:"
    echo "   - user_points"
    echo "   - point_transactions"
    echo "   - point_rules"
    echo "   - point_challenges"
    echo "   - user_challenge_progress"
    echo "   - point_withdrawals"
    echo ""
    echo "✅ New functions created:"
    echo "   - award_points()"
    echo "   - spend_points()"
    echo "   - check_reservation_availability()"
    echo "   - toggle_post_like()"
    echo "   - admin_adjust_points()"
    echo ""
    echo "✅ New views created:"
    echo "   - v_user_profile_overview"
    echo "   - v_post_engagement"
    echo ""
    echo "✅ Default point rules and challenges inserted"
    echo ""
    echo "🚀 Your database is now ready for the points system!"
    echo "   You can start using the admin dashboard at: http://localhost:3001"
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "   - Ensure you have sufficient privileges on the database"
    echo "   - Check that the migration file exists in the current directory"
    echo "   - Verify your database connection details"
    exit 1
fi

echo ""
echo "📚 Next steps:"
echo "   1. Start your admin dashboard: npm run dev"
echo "   2. Test the points system functionality"
echo "   3. Monitor user engagement and points distribution"
echo ""
echo "🔧 If you need to rollback:"
echo "   psql -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U postgres.ksxnvixndizuczbhijbp -d postgres -f rollback_001_points_system.sql"
echo ""
echo "✨ Migration completed! Happy coding!"
