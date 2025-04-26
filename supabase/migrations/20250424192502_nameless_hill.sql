/*
  # Add deal interactions tables
  
  1. New Tables
    - `deal_comments`
      - `id` (uuid, primary key)
      - `deal_id` (uuid, references deals)
      - `user_id` (uuid, references auth.users)
      - `content` (text)
      - `created_at` (timestamp)
    
    - `deal_votes`
      - `id` (uuid, primary key)
      - `deal_id` (uuid, references deals)
      - `user_id` (uuid, references auth.users)
      - `vote_type` (boolean, true = upvote, false = downvote)
      - `created_at` (timestamp)
    
    - `deal_favorites`
      - `id` (uuid, primary key)
      - `deal_id` (uuid, references deals)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create deal_comments table
CREATE TABLE IF NOT EXISTS deal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id, created_at)
);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create comments"
  ON deal_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all comments"
  ON deal_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Create deal_votes table
CREATE TABLE IF NOT EXISTS deal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

ALTER TABLE deal_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can vote"
  ON deal_votes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create deal_favorites table
CREATE TABLE IF NOT EXISTS deal_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

ALTER TABLE deal_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their favorites"
  ON deal_favorites
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create functions to get vote counts
CREATE OR REPLACE FUNCTION get_deal_vote_count(deal_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  upvotes integer;
  downvotes integer;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE vote_type = true),
    COUNT(*) FILTER (WHERE vote_type = false)
  INTO upvotes, downvotes
  FROM deal_votes
  WHERE deal_votes.deal_id = $1;
  
  RETURN COALESCE(upvotes, 0) - COALESCE(downvotes, 0);
END;
$$;