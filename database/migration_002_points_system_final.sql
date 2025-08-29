-- Migration 002: Points System Final Implementation
-- This migration adds the complete points system to existing databases
-- Run this file to upgrade your database schema

-- Start transaction for safe migration
BEGIN;

-- Check if migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_points') THEN
        RAISE NOTICE 'Points system tables already exist. Skipping migration.';
        RETURN;
    END IF;
END $$;

-- Create user_points table
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'advertiser')),
    points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, user_type)
);

-- Create point_transactions table
CREATE TABLE IF NOT EXISTS point_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'advertiser')),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'earned_login', 'earned_reservation', 'earned_referral', 'earned_daily_bonus',
        'earned_content_creation', 'earned_engagement', 'earned_purchase',
        'spent_ad_boost', 'spent_premium_feature', 'spent_gift', 'spent_withdrawal',
        'admin_adjustment', 'system_bonus', 'penalty'
    )),
    points_change INTEGER NOT NULL,
    description TEXT,
    reference_id INTEGER,
    reference_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create point_withdrawals table
CREATE TABLE IF NOT EXISTS point_withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'advertiser')),
    points_amount INTEGER NOT NULL CHECK (points_amount > 0),
    withdrawal_method VARCHAR(50) NOT NULL CHECK (withdrawal_method IN (
        'bank_transfer', 'paypal', 'gift_card', 'crypto'
    )),
    account_details TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user_type ON user_points(user_type);
CREATE INDEX IF NOT EXISTS idx_user_points_balance ON user_points(points_balance);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_type ON point_transactions(user_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_point_withdrawals_user_id ON point_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_point_withdrawals_status ON point_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_point_withdrawals_created_at ON point_withdrawals(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_points_updated_at
    BEFORE UPDATE ON user_points
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- You can comment out these inserts if you don't want sample data

-- Insert sample user points for existing users (if any exist)
DO $$
DECLARE
    user_record RECORD;
    advertiser_record RECORD;
BEGIN
    -- Add points for existing users
    FOR user_record IN SELECT id FROM users LIMIT 5 LOOP
        INSERT INTO user_points (user_id, user_type, points_balance, total_earned, total_spent)
        VALUES (user_record.id, 'user', 1000, 1000, 0)
        ON CONFLICT (user_id, user_type) DO NOTHING;
    END LOOP;
    
    -- Add points for existing advertisers
    FOR advertiser_record IN SELECT id FROM advertisers LIMIT 5 LOOP
        INSERT INTO user_points (user_id, user_type, points_balance, total_earned, total_spent)
        VALUES (advertiser_record.id, 'advertiser', 2000, 2000, 0)
        ON CONFLICT (user_id, user_type) DO NOTHING;
    END LOOP;
END $$;

-- Create a view for easy points overview
CREATE OR REPLACE VIEW v_user_points_overview AS
SELECT 
    up.id,
    up.user_id,
    up.user_type,
    up.points_balance,
    up.total_earned,
    up.total_spent,
    up.created_at,
    up.updated_at,
    CASE 
        WHEN up.user_type = 'user' THEN u.full_name
        WHEN up.user_type = 'advertiser' THEN a.full_name
    END as user_name,
    CASE 
        WHEN up.user_type = 'advertiser' THEN a.store_name
        ELSE NULL
    END as store_name,
    CASE 
        WHEN up.user_type = 'user' THEN u.phone
        WHEN up.user_type = 'advertiser' THEN a.phone
    END as phone
FROM user_points up
LEFT JOIN users u ON up.user_id = u.id AND up.user_type = 'user'
LEFT JOIN advertisers a ON up.user_id = a.id AND up.user_type = 'advertiser';

-- Create a function to safely adjust points
CREATE OR REPLACE FUNCTION safe_adjust_points(
    p_user_id INTEGER,
    p_user_type VARCHAR(20),
    p_points_change INTEGER,
    p_reason TEXT,
    p_transaction_type VARCHAR(50) DEFAULT 'admin_adjustment'
)
RETURNS JSON AS $$
DECLARE
    v_user_point user_points%ROWTYPE;
    v_new_balance INTEGER;
    v_result JSON;
BEGIN
    -- Check if user exists
    IF p_user_type = 'user' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
            RETURN json_build_object('success', false, 'error', 'User not found');
        END IF;
    ELSIF p_user_type = 'advertiser' THEN
        IF NOT EXISTS (SELECT 1 FROM advertisers WHERE id = p_user_id) THEN
            RETURN json_build_object('success', false, 'error', 'Advertiser not found');
        END IF;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid user type');
    END IF;
    
    -- Get or create user points record
    SELECT * INTO v_user_point FROM user_points WHERE user_id = p_user_id AND user_type = p_user_type;
    
    IF v_user_point IS NULL THEN
        -- Create new record
        v_new_balance = GREATEST(0, p_points_change);
        INSERT INTO user_points (user_id, user_type, points_balance, total_earned, total_spent)
        VALUES (p_user_id, p_user_type, v_new_balance, GREATEST(0, p_points_change), GREATEST(0, -p_points_change));
    ELSE
        -- Update existing record
        v_new_balance = GREATEST(0, v_user_point.points_balance + p_points_change);
        UPDATE user_points 
        SET 
            points_balance = v_new_balance,
            total_earned = total_earned + GREATEST(0, p_points_change),
            total_spent = total_spent + GREATEST(0, -p_points_change)
        WHERE user_id = p_user_id AND user_type = p_user_type;
    END IF;
    
    -- Record transaction
    INSERT INTO point_transactions (user_id, user_type, transaction_type, points_change, description, reference_type)
    VALUES (p_user_id, p_user_type, p_transaction_type, p_points_change, p_reason, 'admin_adjustment');
    
    -- Return success result
    v_result = json_build_object(
        'success', true,
        'user_id', p_user_id,
        'user_type', p_user_type,
        'points_change', p_points_change,
        'new_balance', v_new_balance,
        'reason', p_reason
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_points TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON point_transactions TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON point_withdrawals TO postgres;
GRANT SELECT ON v_user_points_overview TO postgres;
GRANT EXECUTE ON FUNCTION safe_adjust_points TO postgres;

-- Commit the transaction
COMMIT;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Points System Migration Completed Successfully!';
    RAISE NOTICE '✅ Tables created: user_points, point_transactions, point_withdrawals';
    RAISE NOTICE '✅ Indexes created for optimal performance';
    RAISE NOTICE '✅ Triggers and functions created';
    RAISE NOTICE '✅ Sample data inserted (if users/advertisers exist)';
    RAISE NOTICE '✅ View created: v_user_points_overview';
    RAISE NOTICE '✅ Function created: safe_adjust_points()';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your database is now ready for the points system!';
    RAISE NOTICE '   You can start using the admin dashboard points functionality.';
END $$;
