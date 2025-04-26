/*
  # Fix deals visibility for all authenticated users

  1. Changes
    - Update RLS policies for deals table to allow all authenticated users to read deals
    - Fix policy names for consistency
    - Add indexes for better performance

  2. Security
    - Maintain secure access control while allowing read access to all authenticated users
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can read deals" ON deals;
  DROP POLICY IF EXISTS "Users can create their own deals" ON deals;
  DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
  DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
END $$;

-- Recreate policies with correct permissions
CREATE POLICY "Anyone can read deals"
  ON deals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own deals"
  ON deals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deals"
  ON deals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deals"
  ON deals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for better performance if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'deals_user_id_idx'
  ) THEN
    CREATE INDEX deals_user_id_idx ON deals(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'deals_created_at_idx'
  ) THEN
    CREATE INDEX deals_created_at_idx ON deals(created_at DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'deals_category_id_idx'
  ) THEN
    CREATE INDEX deals_category_id_idx ON deals(category_id);
  END IF;
END $$;