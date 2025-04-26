/*
  # Add favorites functionality
  
  1. New Tables
    - `deal_favorites`: Store user's favorite deals
    - `promo_favorites`: Store user's favorite promo codes
    
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create deal favorites table
CREATE TABLE IF NOT EXISTS deal_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

-- Create promo favorites table
CREATE TABLE IF NOT EXISTS promo_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promo_id, user_id)
);

-- Enable RLS
ALTER TABLE deal_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for deal favorites
CREATE POLICY "Users can read own deal favorites"
  ON deal_favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add deal favorites"
  ON deal_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove deal favorites"
  ON deal_favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for promo favorites
CREATE POLICY "Users can read own promo favorites"
  ON promo_favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add promo favorites"
  ON promo_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove promo favorites"
  ON promo_favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS deal_favorites_user_id_idx ON deal_favorites(user_id);
CREATE INDEX IF NOT EXISTS deal_favorites_deal_id_idx ON deal_favorites(deal_id);
CREATE INDEX IF NOT EXISTS promo_favorites_user_id_idx ON promo_favorites(user_id);
CREATE INDEX IF NOT EXISTS promo_favorites_promo_id_idx ON promo_favorites(promo_id);