# 🚀 Points System Migration Guide

This guide will help you apply the points system migration to your database.

## 📋 Prerequisites

1. **PostgreSQL Client Tools** installed on your system
2. **Database credentials** for your Supabase database
3. **Access** to your database from your current location

## 🔧 Installation Options

### Option 1: Automated Script (Recommended)

```bash
cd database
chmod +x apply_points_migration.sh
./apply_points_migration.sh
```

### Option 2: Manual Migration

```bash
# Connect to your database
psql -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U postgres.ksxnvixndizuczbhijbp -d postgres

# When prompted, enter your password

# Run the migration
\i migration_002_points_system_final.sql

# Exit psql
\q
```

### Option 3: Direct Command

```bash
PGPASSWORD='your_password' psql -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U postgres.ksxnvixndizuczbhijbp -d postgres -f migration_002_points_system_final.sql
```

## 📊 What the Migration Creates

### Tables
- **`user_points`** - Stores user point balances
- **`point_transactions`** - Records all point transactions
- **`point_withdrawals`** - Manages withdrawal requests

### Indexes
- Performance optimizations for user lookups
- Fast queries by user type and balance
- Efficient transaction history retrieval

### Functions & Triggers
- **`safe_adjust_points()`** - Safe points adjustment function
- **`update_updated_at_column()`** - Automatic timestamp updates

### Views
- **`v_user_points_overview`** - Easy points overview for admins

## 🧪 Testing the Migration

After migration, test these queries:

```sql
-- Check if tables exist
\dt user_points
\dt point_transactions
\dt point_withdrawals

-- Check sample data
SELECT * FROM user_points LIMIT 5;

-- Test the view
SELECT * FROM v_user_points_overview LIMIT 5;
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check your database credentials
   - Ensure your IP is whitelisted in Supabase
   - Verify the database is accessible

2. **Permission Denied**
   - Ensure your user has sufficient privileges
   - Check if you can create tables

3. **Migration Already Applied**
   - The migration will skip if tables already exist
   - Check with `\dt user_points`

### Error Messages

- **"relation already exists"** - Tables already created, migration skipped
- **"permission denied"** - Insufficient database privileges
- **"connection refused"** - Network or firewall issue

## 🔄 After Migration

1. **Restart your server** to recognize new tables
2. **Test the points system** in your admin dashboard
3. **Try adjusting points** for a user
4. **Monitor functionality** and check for errors

## 📚 Next Steps

1. **Start your admin dashboard**: `npm run dev`
2. **Navigate to Points tab** in the dashboard
3. **Test points adjustment** functionality
4. **Verify user points** are displayed correctly

## 🆘 Need Help?

If you encounter issues:

1. **Check the error messages** in the migration output
2. **Verify database connection** with a simple query
3. **Ensure all prerequisites** are met
4. **Check Supabase dashboard** for any restrictions

---

**🎉 Once migration is complete, your points system will work perfectly!**
