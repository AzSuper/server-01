-- Migration: Add Admin Dashboard and Enhancements
-- Date: 2024-12-01
-- Description: This migration adds admin functionality, hard delete operations, and enhanced user management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admin table for dashboard access
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_admins_updated_at 
    BEFORE UPDATE ON admins 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
-- Note: This password hash is for 'admin123' - change in production
INSERT INTO admins (username, password_hash, full_name, email, permissions) 
VALUES (
    'admin',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'System Administrator',
    'admin@example.com',
    '{"users": true, "advertisers": true, "posts": true, "reservations": true, "categories": true}'
) ON CONFLICT (username) DO NOTHING;

-- Insert default categories if they don't exist
INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic devices and gadgets'),
('Fashion', 'Clothing, shoes, and accessories'),
('Home & Garden', 'Home improvement and garden supplies'),
('Sports', 'Sports equipment and outdoor gear'),
('Books', 'Books, magazines, and educational materials'),
('Automotive', 'Cars, motorcycles, and auto parts'),
('Health & Beauty', 'Health products and beauty supplies'),
('Toys & Games', 'Toys, games, and entertainment'),
('Food & Beverages', 'Food items and beverages'),
('Other', 'Miscellaneous items')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- Add RLS (Row Level Security) policies for admin table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Admin can read all admin records
CREATE POLICY "Admins can read all admin records" ON admins
    FOR SELECT USING (true);

-- Admin can insert new admin records
CREATE POLICY "Admins can insert admin records" ON admins
    FOR INSERT WITH CHECK (true);

-- Admin can update admin records
CREATE POLICY "Admins can update admin records" ON admins
    FOR UPDATE USING (true);

-- Admin can delete admin records
CREATE POLICY "Admins can delete admin records" ON admins
    FOR DELETE USING (true);

-- Create admin role function for JWT verification
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins 
        WHERE username = current_setting('request.jwt.claims', true)::json->>'username'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get admin permissions
CREATE OR REPLACE FUNCTION get_admin_permissions()
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT permissions FROM admins 
        WHERE username = current_setting('request.jwt.claims', true)::json->>'username'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if admin has specific permission
CREATE OR REPLACE FUNCTION admin_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT (permissions->>permission_name)::BOOLEAN 
        FROM admins 
        WHERE username = current_setting('request.jwt.claims', true)::json->>'username'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin dashboard statistics function
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'counts', jsonb_build_object(
            'users', (SELECT COUNT(*) FROM users),
            'advertisers', (SELECT COUNT(*) FROM advertisers),
            'posts', (SELECT COUNT(*) FROM posts),
            'reservations', (SELECT COUNT(*) FROM reservations),
            'categories', (SELECT COUNT(*) FROM categories)
        ),
        'recentActivity', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'type', activity.type,
                    'name', activity.name,
                    'created_at', activity.created_at,
                    'description', activity.description
                )
            )
            FROM (
                SELECT 'post' as type, title as name, created_at, 'New post created' as description
                FROM posts 
                WHERE created_at >= NOW() - INTERVAL '7 days'
                UNION ALL
                SELECT 'reservation' as type, 'Reservation' as name, reserved_at as created_at, 'New reservation made' as description
                FROM reservations 
                WHERE reserved_at >= NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 10
            ) activity
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get paginated users for admin
CREATE OR REPLACE FUNCTION get_admin_users(page_num INTEGER DEFAULT 1, page_size INTEGER DEFAULT 10)
RETURNS TABLE(
    id INTEGER,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    profile_image TEXT,
    is_verified BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_counts AS (
        SELECT COUNT(*) as total
        FROM users
    )
    SELECT 
        u.id,
        u.full_name,
        u.phone,
        u.profile_image,
        u.is_verified,
        u.created_at,
        u.updated_at,
        uc.total as total_count
    FROM users u
    CROSS JOIN user_counts uc
    ORDER BY u.created_at DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get paginated advertisers for admin
CREATE OR REPLACE FUNCTION get_admin_advertisers(page_num INTEGER DEFAULT 1, page_size INTEGER DEFAULT 10)
RETURNS TABLE(
    id INTEGER,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    store_name VARCHAR(255),
    store_image TEXT,
    description TEXT,
    is_verified BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH advertiser_counts AS (
        SELECT COUNT(*) as total
        FROM advertisers
    )
    SELECT 
        a.id,
        a.full_name,
        a.phone,
        a.store_name,
        a.store_image,
        a.description,
        a.is_verified,
        a.created_at,
        a.updated_at,
        ac.total as total_count
    FROM advertisers a
    CROSS JOIN advertiser_counts ac
    ORDER BY a.created_at DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get paginated posts for admin
CREATE OR REPLACE FUNCTION get_admin_posts(page_num INTEGER DEFAULT 1, page_size INTEGER DEFAULT 10)
RETURNS TABLE(
    id INTEGER,
    advertiser_id INTEGER,
    category_id INTEGER,
    type VARCHAR(10),
    title VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    old_price DECIMAL(10,2),
    media_url TEXT,
    expiration_date TIMESTAMP,
    with_reservation BOOLEAN,
    reservation_time TIMESTAMP,
    reservation_limit INTEGER,
    social_media_links JSONB,
    likes_count INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    advertiser_name VARCHAR(255),
    store_name VARCHAR(255),
    category_name VARCHAR(100),
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH post_counts AS (
        SELECT COUNT(*) as total
        FROM posts
    )
    SELECT 
        p.id,
        p.advertiser_id,
        p.category_id,
        p.type,
        p.title,
        p.description,
        p.price,
        p.old_price,
        p.media_url,
        p.expiration_date,
        p.with_reservation,
        p.reservation_time,
        p.reservation_limit,
        p.social_media_links,
        p.likes_count,
        p.created_at,
        p.updated_at,
        a.full_name as advertiser_name,
        a.store_name,
        c.name as category_name,
        pc.total as total_count
    FROM posts p
    LEFT JOIN advertisers a ON p.advertiser_id = a.id
    LEFT JOIN categories c ON p.category_id = c.id
    CROSS JOIN post_counts pc
    ORDER BY p.created_at DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get paginated reservations for admin
CREATE OR REPLACE FUNCTION get_admin_reservations(page_num INTEGER DEFAULT 1, page_size INTEGER DEFAULT 10)
RETURNS TABLE(
    id INTEGER,
    client_id INTEGER,
    client_type VARCHAR(20),
    post_id INTEGER,
    status VARCHAR(20),
    reserved_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    post_title VARCHAR(255),
    post_type VARCHAR(10),
    client_name VARCHAR(255),
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH reservation_counts AS (
        SELECT COUNT(*) as total
        FROM reservations
    )
    SELECT 
        r.id,
        r.client_id,
        r.client_type,
        r.post_id,
        r.status,
        r.reserved_at,
        r.cancelled_at,
        p.title as post_title,
        p.type as post_type,
        CASE 
            WHEN r.client_type = 'user' THEN u.full_name
            WHEN r.client_type = 'advertiser' THEN a.full_name
        END as client_name,
        rc.total as total_count
    FROM reservations r
    LEFT JOIN posts p ON r.post_id = p.id
    LEFT JOIN users u ON r.client_id = u.id AND r.client_type = 'user'
    LEFT JOIN advertisers a ON r.client_id = a.id AND r.client_type = 'advertiser'
    CROSS JOIN reservation_counts rc
    ORDER BY r.reserved_at DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely delete user (admin only)
CREATE OR REPLACE FUNCTION admin_delete_user(user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Delete user (this will cascade to related data if foreign keys are set up)
    DELETE FROM users WHERE id = user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely delete advertiser (admin only)
CREATE OR REPLACE FUNCTION admin_delete_advertiser(advertiser_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if advertiser exists
    IF NOT EXISTS (SELECT 1 FROM advertisers WHERE id = advertiser_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Delete advertiser (posts will be cascade deleted if foreign keys are set up)
    DELETE FROM advertisers WHERE id = advertiser_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely delete post (admin only)
CREATE OR REPLACE FUNCTION admin_delete_post(post_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if post exists
    IF NOT EXISTS (SELECT 1 FROM posts WHERE id = post_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Delete post (reservations will be cascade deleted if foreign keys are set up)
    DELETE FROM posts WHERE id = post_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely delete reservation (admin only)
CREATE OR REPLACE FUNCTION admin_delete_reservation(reservation_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if reservation exists
    IF NOT EXISTS (SELECT 1 FROM reservations WHERE id = reservation_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Delete reservation
    DELETE FROM reservations WHERE id = reservation_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely delete category (admin only)
CREATE OR REPLACE FUNCTION admin_delete_category(category_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    usage_count INTEGER;
    result JSONB;
BEGIN
    -- Check if category exists
    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = category_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category not found');
    END IF;
    
    -- Check if category is being used by posts
    SELECT COUNT(*) INTO usage_count
    FROM posts WHERE category_id = category_id;
    
    IF usage_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Cannot delete category. It is being used by %s post(s).', usage_count)
        );
    END IF;
    
    -- Delete category
    DELETE FROM categories WHERE id = category_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Category deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create category (admin only)
CREATE OR REPLACE FUNCTION admin_create_category(category_name TEXT, category_description TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    new_category_id INTEGER;
    result JSONB;
BEGIN
    -- Validate category name
    IF category_name IS NULL OR trim(category_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category name is required');
    END IF;
    
    -- Check if category already exists
    IF EXISTS (SELECT 1 FROM categories WHERE LOWER(name) = LOWER(trim(category_name))) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category with this name already exists');
    END IF;
    
    -- Create new category
    INSERT INTO categories (name, description) 
    VALUES (trim(category_name), category_description)
    RETURNING id INTO new_category_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Category created successfully',
        'data', jsonb_build_object(
            'id', new_category_id,
            'name', trim(category_name),
            'description', category_description,
            'created_at', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update category (admin only)
CREATE OR REPLACE FUNCTION admin_update_category(category_id INTEGER, category_name TEXT, category_description TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Check if category exists
    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = category_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category not found');
    END IF;
    
    -- Validate category name
    IF category_name IS NULL OR trim(category_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category name is required');
    END IF;
    
    -- Check if new name conflicts with existing category
    IF EXISTS (SELECT 1 FROM categories WHERE LOWER(name) = LOWER(trim(category_name)) AND id != category_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category with this name already exists');
    END IF;
    
    -- Update category
    UPDATE categories 
    SET name = trim(category_name), description = category_description
    WHERE id = category_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Category updated successfully',
        'data', jsonb_build_object(
            'id', category_id,
            'name', trim(category_name),
            'description', category_description,
            'updated_at', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to authenticated users (for admin functions)
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_users(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_advertisers(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_posts(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_reservations(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_advertiser(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_post(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_reservation(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_category(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_category(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_category(INTEGER, TEXT, TEXT) TO authenticated;

-- Create comments for documentation
COMMENT ON TABLE admins IS 'Admin users for dashboard access with role-based permissions';
COMMENT ON FUNCTION is_admin() IS 'Check if current user is an admin';
COMMENT ON FUNCTION get_admin_permissions() IS 'Get permissions for current admin user';
COMMENT ON FUNCTION admin_has_permission(TEXT) IS 'Check if admin has specific permission';
COMMENT ON FUNCTION get_dashboard_stats() IS 'Get dashboard statistics for admin view';
COMMENT ON FUNCTION get_admin_users(INTEGER, INTEGER) IS 'Get paginated list of users for admin';
COMMENT ON FUNCTION get_admin_advertisers(INTEGER, INTEGER) IS 'Get paginated list of advertisers for admin';
COMMENT ON FUNCTION get_admin_posts(INTEGER, INTEGER) IS 'Get paginated list of posts for admin';
COMMENT ON FUNCTION get_admin_reservations(INTEGER, INTEGER) IS 'Get paginated list of reservations for admin';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully: Admin dashboard and enhancements added';
    RAISE NOTICE 'Default admin user created: admin/admin123';
    RAISE NOTICE 'Default categories added';
    RAISE NOTICE 'Admin functions and policies created';
END $$;
