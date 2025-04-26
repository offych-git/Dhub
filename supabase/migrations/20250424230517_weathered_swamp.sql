/*
  # Create promo comments table

  1. New Tables
    - `promo_comments`
      - `id` (uuid, primary key)
      - `promo_id` (uuid, foreign key to promo_codes)
      - `user_id` (uuid, foreign key to profiles)
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `promo_comments` table
    - Add policies for:
      - Anyone can read comments
      - Users can create their own comments
      - Users can update their own comments
      - Users can delete their own comments
*/

CREATE TABLE IF NOT EXISTS promo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promo_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON promo_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON promo_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON promo_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON promo_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);