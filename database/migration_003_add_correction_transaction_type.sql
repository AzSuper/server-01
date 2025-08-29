-- Migration 003: Add 'correction' transaction type to point_transactions table
-- This migration adds the 'correction' transaction type to the existing constraint

-- First, drop the existing constraint
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_transaction_type_check;

-- Add the new constraint with 'correction' included
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_transaction_type_check 
CHECK (transaction_type IN (
    'earned_login', 'earned_reservation', 'earned_referral', 'earned_daily_bonus',
    'earned_content_creation', 'earned_engagement', 'earned_purchase',
    'spent_ad_boost', 'spent_premium_feature', 'spent_gift', 'spent_withdrawal',
    'admin_adjustment', 'system_bonus', 'penalty', 'correction'
));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'point_transactions_transaction_type_check';
