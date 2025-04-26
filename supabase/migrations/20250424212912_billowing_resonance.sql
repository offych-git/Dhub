/*
  # Update deals table schema
  
  1. Changes
    - Modify deals table to use text ID instead of UUID
    - Add policies for CRUD operations
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can read deals" ON deals;
  DROP POLICY IF EXISTS "Users can create their own deals" ON deals;
  DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
  DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
END $$;

-- Drop and recreate the deals table
DROP TABLE IF EXISTS deals;

CREATE TABLE deals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  description text,
  current_price numeric NOT NULL,
  original_price numeric,
  image_url text,
  store_id text NOT NULL,
  category_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Recreate policies
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