-- Points System Database Schema
-- This file adds points system functionality to the existing database

-- Points table to track user points
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

-- Points transactions table to track all point activities
CREATE TABLE IF NOT EXISTS point_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'advertiser')),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'earned_login', 'earned_reservation', 'earned_referral', 'earned_daily_bonus',
        'earned_content_creation', 'earned_engagement', 'earned_purchase',
        'spent_ad_boost', 'spent_premium_feature', 'spent_gift', 'spent_withdrawal',
        'admin_adjustment', 'system_bonus', 'penalty', 'correction'
    )),
    points_change INTEGER NOT NULL, -- positive for earned, negative for spent
    description TEXT,
    reference_id INTEGER, -- ID of related post, reservation, etc.
    reference_type VARCHAR(50), -- 'post', 'reservation', 'user', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Points rules table for configurable point values
CREATE TABLE IF NOT EXISTS point_rules (
    id SERIAL PRIMARY KEY,
    action_name VARCHAR(100) NOT NULL UNIQUE,
    points_value INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    daily_limit INTEGER, -- NULL means no limit
    weekly_limit INTEGER, -- NULL means no limit
    monthly_limit INTEGER, -- NULL means no limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Points challenges/achievements table
CREATE TABLE IF NOT EXISTS point_challenges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_reward INTEGER NOT NULL,
    challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
        'daily', 'weekly', 'monthly', 'one_time', 'milestone'
    )),
    requirements JSONB, -- flexible requirements structure
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User challenge progress tracking
CREATE TABLE IF NOT EXISTS user_challenge_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'advertiser')),
    challenge_id INTEGER NOT NULL REFERENCES point_challenges(id) ON DELETE CASCADE,
    progress_value INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, user_type, challenge_id)
);

-- Points withdrawal requests
CREATE TABLE IF NOT EXISTS point_withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'advertiser')),
    points_amount INTEGER NOT NULL CHECK (points_amount > 0),
    withdrawal_method VARCHAR(50) NOT NULL CHECK (withdrawal_method IN (
        'bank_transfer', 'paypal', 'gift_card', 'crypto'
    )),
    withdrawal_details JSONB, -- payment details
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'completed'
    )),
    admin_notes TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user_type ON user_points(user_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_type ON point_transactions(user_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_point_challenges_type ON point_challenges(challenge_type);
CREATE INDEX IF NOT EXISTS idx_point_challenges_active ON point_challenges(is_active);
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_user ON user_challenge_progress(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_challenge ON user_challenge_progress(challenge_id);
CREATE INDEX IF NOT EXISTS idx_point_withdrawals_status ON point_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_point_withdrawals_user ON point_withdrawals(user_id, user_type);

-- Insert default point rules
INSERT INTO point_rules (action_name, points_value, description, daily_limit, weekly_limit, monthly_limit) VALUES
    ('daily_login', 10, 'Daily login bonus', 1, 7, 30),
    ('post_creation', 50, 'Creating a new post', NULL, NULL, NULL),
    ('reservation_made', 25, 'Making a reservation', NULL, NULL, NULL),
    ('reservation_received', 15, 'Receiving a reservation', NULL, NULL, NULL),
    ('post_like', 5, 'Liking a post', 20, 100, 500),
    ('post_comment', 10, 'Commenting on a post', 10, 50, 200),
    ('post_share', 15, 'Sharing a post', 5, 25, 100),
    ('referral_signup', 100, 'Referring a new user', NULL, NULL, NULL),
    ('weekly_streak', 100, '7-day login streak', NULL, 1, 4),
    ('monthly_engagement', 500, 'High monthly engagement', NULL, NULL, 1),
    ('content_quality', 200, 'High-quality content creation', NULL, NULL, NULL),
    ('community_help', 75, 'Helping other users', NULL, NULL, NULL)
ON CONFLICT (action_name) DO NOTHING;

-- Insert default challenges
INSERT INTO point_challenges (name, description, points_reward, challenge_type, requirements) VALUES
    ('First Steps', 'Complete your first reservation', 100, 'one_time', '{"reservations": 1}'),
    ('Social Butterfly', 'Like 10 posts in a day', 50, 'daily', '{"likes": 10}'),
    ('Week Warrior', 'Login for 7 consecutive days', 200, 'weekly', '{"login_streak": 7}'),
    ('Content Creator', 'Create 5 posts in a month', 500, 'monthly', '{"posts": 5}'),
    ('Community Helper', 'Comment on 20 posts in a week', 300, 'weekly', '{"comments": 20}'),
    ('Referral Master', 'Refer 3 new users', 500, 'one_time', '{"referrals": 3}'),
    ('Engagement King', 'Achieve 1000 total engagement actions', 1000, 'milestone', '{"total_engagement": 1000}'),
    ('Reservation Pro', 'Make 10 reservations in a month', 400, 'monthly', '{"reservations": 10}')
ON CONFLICT DO NOTHING;

-- Create function to award points
CREATE OR REPLACE FUNCTION award_points(
    p_user_id INTEGER,
    p_user_type VARCHAR(20),
    p_action_name VARCHAR(100),
    p_reference_id INTEGER DEFAULT NULL,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    points_awarded INTEGER,
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    v_rule point_rules%ROWTYPE;
    v_user_point user_points%ROWTYPE;
    v_daily_count INTEGER := 0;
    v_weekly_count INTEGER := 0;
    v_monthly_count INTEGER := 0;
    v_can_award BOOLEAN := true;
    v_message TEXT := '';
BEGIN
    -- Get the point rule
    SELECT * INTO v_rule FROM point_rules WHERE action_name = p_action_name AND is_active = true;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 'Action not found or inactive'::TEXT;
        RETURN;
    END IF;
    
    -- Check daily limit
    IF v_rule.daily_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_daily_count 
        FROM point_transactions 
        WHERE user_id = p_user_id 
        AND user_type = p_user_type 
        AND transaction_type = p_action_name 
        AND created_at >= CURRENT_DATE;
        
        IF v_daily_count >= v_rule.daily_limit THEN
            v_can_award := false;
            v_message := 'Daily limit reached for this action';
        END IF;
    END IF;
    
    -- Check weekly limit
    IF v_rule.weekly_limit IS NOT NULL AND v_can_award THEN
        SELECT COUNT(*) INTO v_weekly_count 
        FROM point_transactions 
        WHERE user_id = p_user_id 
        AND user_type = p_user_type 
        AND transaction_type = p_action_name 
        AND created_at >= DATE_TRUNC('week', CURRENT_DATE);
        
        IF v_weekly_count >= v_rule.weekly_limit THEN
            v_can_award := false;
            v_message := 'Weekly limit reached for this action';
        END IF;
    END IF;
    
    -- Check monthly limit
    IF v_rule.monthly_limit IS NOT NULL AND v_can_award THEN
        SELECT COUNT(*) INTO v_monthly_count 
        FROM point_transactions 
        WHERE user_id = p_user_id 
        AND user_type = p_user_type 
        AND transaction_type = p_action_name 
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
        
        IF v_monthly_count >= v_rule.monthly_limit THEN
            v_can_award := false;
            v_message := 'Monthly limit reached for this action';
        END IF;
    END IF;
    
    IF NOT v_can_award THEN
        RETURN QUERY SELECT false, 0, 0, v_message;
        RETURN;
    END IF;
    
    -- Get or create user points record
    SELECT * INTO v_user_point FROM user_points WHERE user_id = p_user_id AND user_type = p_user_type;
    IF NOT FOUND THEN
        INSERT INTO user_points (user_id, user_type, points_balance, total_earned)
        VALUES (p_user_id, p_user_type, v_rule.points_value, v_rule.points_value)
        RETURNING * INTO v_user_point;
    ELSE
        UPDATE user_points 
        SET points_balance = points_balance + v_rule.points_value,
            total_earned = total_earned + v_rule.points_value,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id AND user_type = p_user_type
        RETURNING * INTO v_user_point;
    END IF;
    
    -- Record the transaction
    INSERT INTO point_transactions (
        user_id, user_type, transaction_type, points_change, 
        description, reference_id, reference_type
    ) VALUES (
        p_user_id, p_user_type, p_action_name, v_rule.points_value,
        COALESCE(p_description, v_rule.description), p_reference_id, p_reference_type
    );
    
    RETURN QUERY SELECT true, v_rule.points_value, v_user_point.points_balance, 'Points awarded successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function to spend points
CREATE OR REPLACE FUNCTION spend_points(
    p_user_id INTEGER,
    p_user_type VARCHAR(20),
    p_action_name VARCHAR(100),
    p_points_amount INTEGER,
    p_reference_id INTEGER DEFAULT NULL,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    points_spent INTEGER,
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    v_user_point user_points%ROWTYPE;
BEGIN
    -- Get user points
    SELECT * INTO v_user_point FROM user_points WHERE user_id = p_user_id AND user_type = p_user_type;
    IF NOT FOUND OR v_user_point.points_balance < p_points_amount THEN
        RETURN QUERY SELECT false, 0, COALESCE(v_user_point.points_balance, 0), 'Insufficient points'::TEXT;
        RETURN;
    END IF;
    
    -- Update user points
    UPDATE user_points 
    SET points_balance = points_balance - p_points_amount,
        total_spent = total_spent + p_points_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND user_type = p_user_type
    RETURNING * INTO v_user_point;
    
    -- Record the transaction
    INSERT INTO point_transactions (
        user_id, user_type, transaction_type, points_change, 
        description, reference_id, reference_type
    ) VALUES (
        p_user_id, p_user_type, p_action_name, -p_points_amount,
        p_description, p_reference_id, p_reference_type
    );
    
    RETURN QUERY SELECT true, p_points_amount, v_user_point.points_balance, 'Points spent successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger for new tables
CREATE TRIGGER update_user_points_updated_at BEFORE UPDATE ON user_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_point_rules_updated_at BEFORE UPDATE ON point_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_challenge_progress_updated_at BEFORE UPDATE ON user_challenge_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_point_withdrawals_updated_at BEFORE UPDATE ON point_withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
