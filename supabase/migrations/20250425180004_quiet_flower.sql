/*
  # Add foreign key constraint to deal_comments table

  1. Changes
    - Add foreign key constraint from deal_comments.deal_id to deals.id
    - This enables proper joins between deal_comments and deals tables
    - Ensures referential integrity for comments

  2. Security
    - No changes to RLS policies
    - Existing table permissions remain unchanged
*/

DO $$ BEGIN
  -- Add foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'deal_comments_deal_id_fkey'
  ) THEN
    ALTER TABLE deal_comments
    ADD CONSTRAINT deal_comments_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES deals(id)
    ON DELETE CASCADE;
  END IF;
END $$;