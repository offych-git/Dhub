/*
  # Create promo codes table

  1. New Tables
    - `promo_codes`
      - `id` (uuid, primary key)
      - `code` (text, not null)
      - `title` (text, not null)
      - `description` (text, not null)
      - `category_id` (text, not null)
      - `discount_url` (text, not null)
      - `expires_at` (timestamptz)
      - `user_id` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `promo_codes` table
    - Add policies for authenticated users to:
      - Read all promo codes
      - Create their own promo codes
      - Update their own promo codes
      - Delete their own promo codes
*/

CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category_id text NOT NULL,
  discount_url text NOT NULL,
  expires_at timestamptz,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read promo codes"
  ON promo_codes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create promo codes"
  ON promo_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own promo codes"
  ON promo_codes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own promo codes"
  ON promo_codes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX promo_codes_user_id_idx ON promo_codes(user_id);
CREATE INDEX promo_codes_category_id_idx ON promo_codes(category_id);
CREATE INDEX promo_codes_created_at_idx ON promo_codes(created_at DESC);