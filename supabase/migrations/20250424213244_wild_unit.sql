/*
  # Add foreign key relationship between deal_comments and profiles

  1. Changes
    - Add foreign key constraint to deal_comments table linking user_id to profiles.id
    - Add ON DELETE CASCADE to automatically remove comments when a profile is deleted

  2. Security
    - No changes to RLS policies
*/

-- Add foreign key constraint
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'deal_comments_user_id_fkey'
  ) THEN
    ALTER TABLE deal_comments
    ADD CONSTRAINT deal_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;