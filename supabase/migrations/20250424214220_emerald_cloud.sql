/*
  # Fix deal comments and profiles relationship

  1. Changes
    - Add foreign key constraint from deal_comments.user_id to profiles.id
    - Drop and recreate RLS policies to ensure proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read comments" ON deal_comments;
DROP POLICY IF EXISTS "Users can create comments" ON deal_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON deal_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON deal_comments;

-- Drop and recreate foreign key constraint
ALTER TABLE deal_comments
DROP CONSTRAINT IF EXISTS deal_comments_user_id_fkey;

ALTER TABLE deal_comments
ADD CONSTRAINT deal_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;

-- Recreate policies with proper access control
CREATE POLICY "Anyone can read comments"
  ON deal_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON deal_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON deal_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON deal_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);