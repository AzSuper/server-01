# 🚀 Supabase Migrations

This folder contains database migrations for the Flutter Backend API with Admin Dashboard functionality.

## 📁 Migration Files

### 1. **`20241201000000_add_admin_dashboard_and_enhancements.sql`**
**Main migration** that adds:
- ✅ Admin table with default user (`admin`/`admin123`)
- ✅ Admin functions for dashboard operations
- ✅ Row Level Security (RLS) policies
- ✅ Default categories
- ✅ Performance indexes
- ✅ Hard delete operations (no soft delete)

### 2. **`20241201000001_rollback_admin_dashboard.sql`**
**Rollback migration** to undo all changes if needed.

## 🚀 How to Apply Migrations

### **Option 1: Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the migration content
4. Click **Run** to execute

### **Option 2: Supabase CLI**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push

# Or run specific migration
supabase db reset
```

### **Option 3: Direct Database Connection**
```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migration
\i supabase/migrations/20241201000000_add_admin_dashboard_and_enhancements.sql
```

## 🔐 Default Admin Credentials

After running the migration, you'll have a default admin user:

- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@example.com`

**⚠️ Important**: Change these credentials in production!

## 🗄️ What Gets Created

### **Tables**
- `admins` - Admin users with permissions

### **Functions**
- `is_admin()` - Check if user is admin
- `get_admin_permissions()` - Get admin permissions
- `admin_has_permission()` - Check specific permission
- `get_dashboard_stats()` - Dashboard statistics
- `get_admin_users()` - Paginated user list
- `get_admin_advertisers()` - Paginated advertiser list
- `get_admin_posts()` - Paginated post list
- `get_admin_reservations()` - Paginated reservation list
- `admin_delete_*()` - Hard delete operations
- `admin_create_category()` - Create categories
- `admin_update_category()` - Update categories

### **Security**
- Row Level Security (RLS) enabled
- Admin-only access policies
- JWT-based authentication support

### **Performance**
- Database indexes on frequently queried columns
- Optimized queries with pagination
- Efficient JOIN operations

## 🔧 Testing the Migration

### **1. Verify Admin Table**
```sql
-- Check if admin table exists
SELECT * FROM admins;

-- Should return:
-- id | username | full_name | email | permissions
-- 1  | admin    | System Administrator | admin@example.com | {"users": true, ...}
```

### **2. Test Admin Functions**
```sql
-- Test dashboard stats
SELECT get_dashboard_stats();

-- Test user listing
SELECT * FROM get_admin_users(1, 10);

-- Test category creation
SELECT admin_create_category('Test Category', 'Test Description');
```

### **3. Test Hard Delete**
```sql
-- Test user deletion (replace 1 with actual user ID)
SELECT admin_delete_user(1);

-- Test category deletion (replace 1 with actual category ID)
SELECT admin_delete_category(1);
```

## 🚨 Troubleshooting

### **Common Issues**

#### **1. Permission Denied**
```sql
-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
```

#### **2. Function Not Found**
```sql
-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE 'admin_%';
```

#### **3. RLS Policy Issues**
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE tablename = 'admins';
```

### **Reset Everything**
```bash
# If you need to start over
supabase db reset

# Or manually drop everything
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

## 📱 Integration with Your API

### **1. Update Environment Variables**
```bash
# Add to your .env file
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **2. Test Admin Login**
```bash
curl -X POST https://your-api.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### **3. Use Admin Token**
```bash
curl -X GET https://your-api.com/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🔒 Security Considerations

### **Production Checklist**
- [ ] Change default admin password
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS only
- [ ] Set up proper CORS policies
- [ ] Implement rate limiting
- [ ] Add IP whitelisting for admin access
- [ ] Enable audit logging

### **Admin Access Control**
- [ ] Limit admin creation to super admins
- [ ] Implement permission-based access
- [ ] Add two-factor authentication
- [ ] Monitor admin actions

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT Authentication](https://supabase.com/docs/guides/auth/overview)

## 🆘 Need Help?

If you encounter issues:

1. **Check Supabase logs** in the dashboard
2. **Verify database connection** and permissions
3. **Test functions individually** to isolate issues
4. **Check RLS policies** are correctly applied
5. **Ensure JWT tokens** are properly configured

---

**Migration Status**: ✅ Ready to deploy  
**Last Updated**: December 1, 2024  
**Version**: 1.0.0
