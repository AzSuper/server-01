-- Rollback Migration 001: Points System Removal
-- This file will safely remove the points system from your database
-- WARNING: This will permanently delete all points data!

-- Start transaction for safe rollback
BEGIN;

-- Check if migration exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001_points_system') THEN
        RAISE NOTICE 'Migration 001 has not been applied. Nothing to rollback.';
        RETURN;
    END IF;
END $$;

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS v_post_engagement;
DROP VIEW IF EXISTS v_user_profile_overview;

-- Drop functions
DROP FUNCTION IF EXISTS admin_adjust_points(INTEGER, VARCHAR(20), INTEGER, TEXT);
DROP FUNCTION IF EXISTS toggle_post_like(INTEGER, VARCHAR(20), INTEGER);
DROP FUNCTION IF EXISTS check_reservation_availability(INTEGER, INTEGER, VARCHAR(20));
DROP FUNCTION IF EXISTS spend_points(INTEGER, VARCHAR(20), VARCHAR(100), INTEGER, INTEGER, VARCHAR(50), TEXT);
DROP FUNCTION IF EXISTS award_points(INTEGER, VARCHAR(20), VARCHAR(100), INTEGER, VARCHAR(50), TEXT);

-- Drop triggers
DROP TRIGGER IF EXISTS update_point_withdrawals_updated_at ON point_withdrawals;
DROP TRIGGER IF EXISTS update_user_challenge_progress_updated_at ON user_challenge_progress;
DROP TRIGGER IF EXISTS update_point_rules_updated_at ON point_rules;
DROP TRIGGER IF EXISTS update_user_points_updated_at ON user_points;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS point_withdrawals CASCADE;
DROP TABLE IF EXISTS user_challenge_progress CASCADE;
DROP TABLE IF EXISTS point_challenges CASCADE;
DROP TABLE IF EXISTS point_transactions CASCADE;
DROP TABLE IF EXISTS point_rules CASCADE;
DROP TABLE IF EXISTS user_points CASCADE;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '001_points_system';

-- Commit the rollback
COMMIT;

-- Display rollback message
DO $$
BEGIN
    RAISE NOTICE 'Rollback 001: Points System successfully removed!';
    RAISE NOTICE 'All points system tables, functions, and views have been dropped.';
    RAISE WARNING 'All points data has been permanently deleted!';
END $$;
