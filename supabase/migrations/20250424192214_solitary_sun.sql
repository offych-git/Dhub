/*
  # Add deal interactions tables
  
  1. New Tables
    - deal_votes: Store user votes on deals
    - deal_comments: Store deal comments
    - deal_favorites: Store user's favorite deals
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Deal votes table
CREATE TABLE IF NOT EXISTS deal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

ALTER TABLE deal_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all votes"
  ON deal_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON deal_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON deal_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Deal comments table
CREATE TABLE IF NOT EXISTS deal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON deal_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON deal_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Deal favorites table
CREATE TABLE IF NOT EXISTS deal_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

ALTER TABLE deal_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own favorites"
  ON deal_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON deal_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON deal_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);