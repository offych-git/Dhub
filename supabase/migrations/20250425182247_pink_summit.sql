/*
  # Add comment likes functionality

  1. New Tables
    - `comment_likes`
      - `id` (uuid, primary key)
      - `comment_id` (uuid, references deal_comments or promo_comments)
      - `user_id` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `comment_type` (text, either 'deal' or 'promo')

  2. Changes
    - Add like_count column to deal_comments and promo_comments
    - Add function to update like count
    - Add triggers for like count updates

  3. Security
    - Enable RLS on comment_likes table
    - Add policies for authenticated users
*/

-- Create comment_likes table
CREATE TABLE comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  comment_type text NOT NULL CHECK (comment_type IN ('deal', 'promo')),
  UNIQUE(comment_id, user_id, comment_type)
);

-- Add like_count to comments tables
ALTER TABLE deal_comments
ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;

ALTER TABLE promo_comments
ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;

-- Enable RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read comment likes"
  ON comment_likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comment likes"
  ON comment_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment likes"
  ON comment_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update like count
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.comment_type = 'deal' THEN
      UPDATE deal_comments
      SET like_count = like_count + 1
      WHERE id = NEW.comment_id;
    ELSE
      UPDATE promo_comments
      SET like_count = like_count + 1
      WHERE id = NEW.comment_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.comment_type = 'deal' THEN
      UPDATE deal_comments
      SET like_count = GREATEST(0, like_count - 1)
      WHERE id = OLD.comment_id;
    ELSE
      UPDATE promo_comments
      SET like_count = GREATEST(0, like_count - 1)
      WHERE id = OLD.comment_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER comment_likes_trigger
AFTER INSERT OR DELETE ON comment_likes
FOR EACH ROW
EXECUTE FUNCTION update_comment_like_count();

-- Create indexes
CREATE INDEX comment_likes_comment_id_idx ON comment_likes(comment_id);
CREATE INDEX comment_likes_user_id_idx ON comment_likes(user_id);
CREATE INDEX deal_comments_like_count_idx ON deal_comments(like_count DESC);
CREATE INDEX promo_comments_like_count_idx ON promo_comments(like_count DESC);