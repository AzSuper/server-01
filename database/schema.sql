-- Flutter Backend Database Schema
-- This file contains all the necessary tables and indexes for the application

-- Enable UUID extension (optional, for better ID handling)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Updated for phone-based authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'advertiser', 'admin')),
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advertiser profiles table
CREATE TABLE IF NOT EXISTS advertiser_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    description TEXT,
    social_media_links JSONB, -- Store social media links as JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTP table for phone verification and password reset
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('verification', 'password_reset')),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE CHECK (char_length(trim(name)) > 0),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts table - Updated for new post types and features
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    advertiser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('reel', 'post')),
    title VARCHAR(255) NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    price DECIMAL(10,2) CHECK (price IS NULL OR price >= 0),
    old_price DECIMAL(10,2) CHECK (old_price IS NULL OR old_price >= 0),
    media_url TEXT,
    expiration_date TIMESTAMP,
    with_reservation BOOLEAN DEFAULT false,
    reservation_time TIMESTAMP,
    reservation_limit INTEGER CHECK (reservation_limit > 0),
    social_media_links JSONB, -- Store social media links as JSON
    likes_count INTEGER DEFAULT 0 CHECK (likes_count >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        with_reservation OR (reservation_time IS NULL AND reservation_limit IS NULL)
    )
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    UNIQUE(client_id, post_id)
);

-- Migration helper: ensure new columns exist on existing installations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'status'
    ) THEN
        EXECUTE 'ALTER TABLE reservations ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''active''';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'cancelled_at'
    ) THEN
        EXECUTE 'ALTER TABLE reservations ADD COLUMN cancelled_at TIMESTAMP';
    END IF;
END $$;

-- Saved posts table (for user bookmarks)
CREATE TABLE IF NOT EXISTS saved_posts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, post_id)
);

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
-- Case-insensitive lookup for emails
-- Enforce case-insensitive uniqueness for emails
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- OTP indexes
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_type ON otp_codes(type);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Advertiser profiles indexes
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_user_id ON advertiser_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_store_name ON advertiser_profiles(store_name);
CREATE INDEX IF NOT EXISTS idx_posts_advertiser_id ON posts(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_with_reservation ON posts(with_reservation);
CREATE INDEX IF NOT EXISTS idx_posts_expiration_date ON posts(expiration_date);
CREATE INDEX IF NOT EXISTS idx_posts_social_media_links_gin ON posts USING GIN (social_media_links);
CREATE INDEX IF NOT EXISTS idx_posts_likes_count ON posts(likes_count);
-- Optimize queries by reservation deadline only for posts that accept reservations
CREATE INDEX IF NOT EXISTS idx_posts_reservation_deadline ON posts(reservation_time) WHERE with_reservation = true;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_client_id ON reservations(client_id);
CREATE INDEX IF NOT EXISTS idx_reservations_post_id ON reservations(post_id);
CREATE INDEX IF NOT EXISTS idx_reservations_reserved_at ON reservations(reserved_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_saved_posts_client_id ON saved_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);

-- Post likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON post_likes(created_at);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_posts_advertiser_type ON posts(advertiser_id, type);
CREATE INDEX IF NOT EXISTS idx_posts_category_type ON posts(category_id, type);
CREATE INDEX IF NOT EXISTS idx_reservations_post_client ON reservations(post_id, client_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_post ON post_likes(user_id, post_id);

-- Insert some default categories
INSERT INTO categories (name, description) VALUES
    ('Electronics', 'Electronic devices and gadgets'),
    ('Fashion', 'Clothing, accessories, and style items'),
    ('Home & Garden', 'Home improvement and garden supplies'),
    ('Sports', 'Sports equipment and athletic gear'),
    ('Books', 'Books, magazines, and educational materials'),
    ('Automotive', 'Cars, parts, and automotive services'),
    ('Health & Beauty', 'Health products and beauty supplies'),
    ('Food & Beverage', 'Food items and beverages'),
    ('Toys & Games', 'Toys, games, and entertainment'),
    ('Other', 'Miscellaneous items and services')
ON CONFLICT (name) DO NOTHING;

-- Ensure case-insensitive uniqueness for category names as well
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name_lower ON categories (LOWER(name));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_advertiser_profiles_updated_at BEFORE UPDATE ON advertiser_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enforce that only advertisers/admins can create posts
CREATE OR REPLACE FUNCTION ensure_advertiser_role_on_post()
RETURNS TRIGGER AS $$
DECLARE
    v_role VARCHAR(50);
BEGIN
    SELECT role INTO v_role FROM users WHERE id = NEW.advertiser_id;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Advertiser (user_id=%) not found', NEW.advertiser_id;
    END IF;
    IF v_role NOT IN ('advertiser','admin') THEN
        RAISE EXCEPTION 'Only advertisers or admins can create posts (user_id=% has role=%)', NEW.advertiser_id, v_role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_ensure_advertiser_role ON posts;
CREATE TRIGGER trg_posts_ensure_advertiser_role
BEFORE INSERT OR UPDATE OF advertiser_id ON posts
FOR EACH ROW EXECUTE FUNCTION ensure_advertiser_role_on_post();

-- Enforce reservation business rules at insert time
CREATE OR REPLACE FUNCTION enforce_reservation_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_post posts%ROWTYPE;
    v_count INTEGER;
BEGIN
    SELECT * INTO v_post FROM posts WHERE id = NEW.post_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Post not found (post_id=%)', NEW.post_id;
    END IF;

    IF v_post.with_reservation = false THEN
        RAISE EXCEPTION 'Post does not accept reservations (post_id=%)', NEW.post_id;
    END IF;

    IF v_post.reservation_time IS NOT NULL AND v_post.reservation_time <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Reservation time has expired for post (post_id=%)', NEW.post_id;
    END IF;

    IF v_post.reservation_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM reservations WHERE post_id = NEW.post_id;
        IF v_count >= v_post.reservation_limit THEN
            RAISE EXCEPTION 'Reservation limit reached (post_id=%, limit=%)', NEW.post_id, v_post.reservation_limit;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservations_enforce_rules ON reservations;
CREATE TRIGGER trg_reservations_enforce_rules
BEFORE INSERT ON reservations
FOR EACH ROW EXECUTE FUNCTION enforce_reservation_rules();

-- User profiles for both clients and advertisers
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    bio TEXT,
    website TEXT,
    company_name VARCHAR(255),
    location VARCHAR(255),
    social_links JSONB, -- arbitrary social links, e.g., {"instagram":"..."}
    metadata JSONB,     -- extensible profile data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-user settings (applies to both clients and advertisers)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notifications_email BOOLEAN DEFAULT true,
    notifications_push BOOLEAN DEFAULT true,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(64) DEFAULT 'UTC',
    profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public','private','followers')),
    marketing_opt_in BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Helpful functional indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name_lower ON user_profiles (LOWER(display_name));
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_name_lower ON user_profiles (LOWER(company_name));
-- JSONB indexes for flexible querying
CREATE INDEX IF NOT EXISTS idx_user_profiles_social_links_gin ON user_profiles USING GIN (social_links);
CREATE INDEX IF NOT EXISTS idx_user_profiles_metadata_gin ON user_profiles USING GIN (metadata);

-- Comments for posts (by any user)
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted','pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent deep nesting beyond a reasonable level (e.g., 5) using a function
CREATE OR REPLACE FUNCTION comments_depth_exceeds_limit(p_parent_id INTEGER, p_limit INTEGER)
RETURNS BOOLEAN AS $$
WITH RECURSIVE tree AS (
    SELECT 1 AS depth, c.parent_comment_id
    FROM comments c
    WHERE c.id = p_parent_id
    UNION ALL
    SELECT depth + 1, c.parent_comment_id
    FROM comments c
    JOIN tree t ON c.id = t.parent_comment_id
)
SELECT COALESCE(MAX(depth), 0) > p_limit FROM tree;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION enforce_comment_depth_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_comment_id IS NOT NULL THEN
        IF comments_depth_exceeds_limit(NEW.parent_comment_id, 5) THEN
            RAISE EXCEPTION 'Maximum comment nesting depth exceeded';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comments_depth_limit ON comments;
CREATE TRIGGER trg_comments_depth_limit
BEFORE INSERT OR UPDATE OF parent_comment_id ON comments
FOR EACH ROW EXECUTE FUNCTION enforce_comment_depth_limit();

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_visible_post_id ON comments(post_id) WHERE status = 'visible';

-- updated_at triggers for new tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle post likes
CREATE OR REPLACE FUNCTION toggle_post_like(
    p_user_id INTEGER,
    p_post_id INTEGER
)
RETURNS TABLE(
    action TEXT,
    likes_count INTEGER,
    is_liked BOOLEAN
) AS $$
DECLARE
    v_exists BOOLEAN;
    v_current_likes INTEGER;
BEGIN
    -- Check if like already exists
    SELECT EXISTS(SELECT 1 FROM post_likes WHERE user_id = p_user_id AND post_id = p_post_id) INTO v_exists;
    
    -- Get current likes count
    SELECT likes_count INTO v_current_likes FROM posts WHERE id = p_post_id;
    
    IF v_exists THEN
        -- Unlike: remove the like
        DELETE FROM post_likes WHERE user_id = p_user_id AND post_id = p_post_id;
        UPDATE posts SET likes_count = likes_count - 1 WHERE id = p_post_id;
        
        RETURN QUERY SELECT 
            'unliked'::TEXT,
            (v_current_likes - 1)::INTEGER,
            false::BOOLEAN;
    ELSE
        -- Like: add the like
        INSERT INTO post_likes (user_id, post_id) VALUES (p_user_id, p_post_id);
        UPDATE posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
        
        RETURN QUERY SELECT 
            'liked'::TEXT,
            (v_current_likes + 1)::INTEGER,
            true::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to check reservation availability
CREATE OR REPLACE FUNCTION check_reservation_availability(
    p_post_id INTEGER,
    p_client_id INTEGER
)
RETURNS TABLE(
    is_available BOOLEAN,
    reason TEXT,
    available_slots INTEGER
) AS $$
DECLARE
    v_post posts%ROWTYPE;
    v_current_reservations INTEGER := 0;
    v_available_slots INTEGER := -1;
BEGIN
    -- Get post details
    SELECT * INTO v_post FROM posts WHERE id = p_post_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Post not found'::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Check if post supports reservations
    IF NOT v_post.with_reservation THEN
        RETURN QUERY SELECT false, 'Post does not support reservations'::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Check if reservation time has expired
    IF v_post.reservation_time IS NOT NULL AND v_post.reservation_time <= CURRENT_TIMESTAMP THEN
        RETURN QUERY SELECT false, 'Reservation time has expired'::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Check if client already has a reservation
    IF EXISTS(SELECT 1 FROM reservations WHERE client_id = p_client_id AND post_id = p_post_id) THEN
        RETURN QUERY SELECT false, 'Client already has a reservation for this post'::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Get current reservation count
    SELECT COUNT(*) INTO v_current_reservations FROM reservations WHERE post_id = p_post_id;
    
    -- Check reservation limit
    IF v_post.reservation_limit IS NOT NULL AND v_current_reservations >= v_post.reservation_limit THEN
        RETURN QUERY SELECT false, 'Reservation limit reached'::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Calculate available slots
    IF v_post.reservation_limit IS NOT NULL THEN
        v_available_slots := v_post.reservation_limit - v_current_reservations;
    ELSE
        v_available_slots := -1; -- Unlimited
    END IF;
    
    RETURN QUERY SELECT true, 'Available'::TEXT, v_available_slots;
END;
$$ LANGUAGE plpgsql;

-- Views to support profile API and post engagement
CREATE OR REPLACE VIEW v_user_profile_overview AS
SELECT
    u.id AS user_id,
    u.name,
    u.email,
    u.role,
    COALESCE(up.display_name, u.name) AS display_name,
    up.avatar_url,
    up.company_name,
    up.location,
    up.website,
    up.social_links,
    up.metadata,
    (SELECT COUNT(*) FROM posts p WHERE p.advertiser_id = u.id) AS total_posts,
    (SELECT COUNT(*) FROM reservations r JOIN posts p2 ON r.post_id = p2.id WHERE p2.advertiser_id = u.id) AS total_reservations_on_my_posts,
    (SELECT COUNT(*) FROM reservations r WHERE r.client_id = u.id) AS total_reservations_made,
    (SELECT COUNT(*) FROM saved_posts sp WHERE sp.client_id = u.id) AS total_saved_posts
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id;

CREATE OR REPLACE VIEW v_post_engagement AS
SELECT
    p.id AS post_id,
    p.title,
    p.type,
    p.advertiser_id,
    p.with_reservation,
    p.reservation_limit,
    p.reservation_time,
    p.likes_count,
    (SELECT COUNT(*) FROM reservations r WHERE r.post_id = p.id) AS reservation_count,
    (SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id) AS saved_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count
FROM posts p;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
