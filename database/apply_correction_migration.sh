#!/bin/bash

# Migration script to add 'correction' transaction type
# This fixes the constraint violation error when adjusting points

echo "🔧 Applying Migration 003: Add 'correction' transaction type..."

# Check if database connection details are available
if [ -z "$DATABASE_URL" ] && [ -z "$DB_HOST" ]; then
    echo "❌ Error: Database connection details not found."
    echo "Please set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD environment variables."
    exit 1
fi

# Apply the migration
if [ ! -z "$DATABASE_URL" ]; then
    echo "📡 Using DATABASE_URL connection..."
    psql "$DATABASE_URL" -f migration_003_add_correction_transaction_type.sql
else
    echo "📡 Using individual database parameters..."
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f migration_003_add_correction_transaction_type.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Migration 003 applied successfully!"
    echo "🎯 'correction' transaction type is now allowed in point_transactions table."
else
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi
