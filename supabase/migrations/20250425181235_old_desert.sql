/*
  # Add threaded comments support
  
  1. Changes
    - Add parent_id to deal_comments and promo_comments tables
    - Add reply_count to track number of replies
    - Add indexes for better performance
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add parent_id and reply_count to deal_comments
ALTER TABLE deal_comments
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES deal_comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0;

-- Add parent_id and reply_count to promo_comments
ALTER TABLE promo_comments
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES promo_comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS deal_comments_parent_id_idx ON deal_comments(parent_id);
CREATE INDEX IF NOT EXISTS promo_comments_parent_id_idx ON promo_comments(parent_id);

-- Create function to update reply count
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    -- Increment reply count for parent comment
    IF TG_TABLE_NAME = 'deal_comments' THEN
      UPDATE deal_comments
      SET reply_count = reply_count + 1
      WHERE id = NEW.parent_id;
    ELSE
      UPDATE promo_comments
      SET reply_count = reply_count + 1
      WHERE id = NEW.parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    -- Decrement reply count for parent comment
    IF TG_TABLE_NAME = 'deal_comments' THEN
      UPDATE deal_comments
      SET reply_count = GREATEST(0, reply_count - 1)
      WHERE id = OLD.parent_id;
    ELSE
      UPDATE promo_comments
      SET reply_count = GREATEST(0, reply_count - 1)
      WHERE id = OLD.parent_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for reply count updates
DROP TRIGGER IF EXISTS deal_comments_reply_count_trigger ON deal_comments;
CREATE TRIGGER deal_comments_reply_count_trigger
AFTER INSERT OR DELETE ON deal_comments
FOR EACH ROW
EXECUTE FUNCTION update_comment_reply_count();

DROP TRIGGER IF EXISTS promo_comments_reply_count_trigger ON promo_comments;
CREATE TRIGGER promo_comments_reply_count_trigger
AFTER INSERT OR DELETE ON promo_comments
FOR EACH ROW
EXECUTE FUNCTION update_comment_reply_count();