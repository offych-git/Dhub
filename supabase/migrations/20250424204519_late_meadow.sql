/*
  # Fix deal votes and comments schema

  1. Changes
    - Update deal_votes table to use text for vote_type
    - Fix foreign key relationship for deal_comments
    - Add check constraint for vote_type values

  2. Security
    - Maintain existing RLS policies
*/

-- Update deal_votes table
ALTER TABLE deal_votes
DROP CONSTRAINT IF EXISTS deal_votes_vote_type_check;

ALTER TABLE deal_votes
ADD CONSTRAINT deal_votes_vote_type_check 
CHECK (vote_type IN ('up', 'down'));

-- Fix deal_comments foreign key relationship
ALTER TABLE deal_comments
DROP CONSTRAINT IF EXISTS deal_comments_user_id_fkey;

ALTER TABLE deal_comments
ADD CONSTRAINT deal_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;