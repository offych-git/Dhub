/*
  # Create deals table

  1. New Tables
    - `deals`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, required)
      - `current_price` (numeric, required)
      - `original_price` (numeric, optional)
      - `store_id` (text, required)
      - `category_id` (text, required)
      - `image_url` (text, required)
      - `deal_url` (text, required)
      - `user_id` (uuid, required, references profiles)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
      - `expires_at` (timestamp with time zone, optional)

  2. Security
    - Enable RLS on `deals` table
    - Add policies for:
      - Anyone can read deals
      - Authenticated users can create deals
      - Users can update/delete their own deals
*/

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  current_price numeric NOT NULL CHECK (current_price >= 0),
  original_price numeric CHECK (original_price >= current_price),
  store_id text NOT NULL,
  category_id text NOT NULL,
  image_url text NOT NULL,
  deal_url text NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read deals"
  ON deals
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create deals"
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

-- Add indexes for better performance
CREATE INDEX deals_user_id_idx ON deals(user_id);
CREATE INDEX deals_store_id_idx ON deals(store_id);
CREATE INDEX deals_category_id_idx ON deals(category_id);
CREATE INDEX deals_created_at_idx ON deals(created_at DESC);