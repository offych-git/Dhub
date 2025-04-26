/*
  # Create deal tables and functions

  1. New Tables
    - `deal_votes`
      - `id` (uuid, primary key)
      - `deal_id` (text)
      - `user_id` (uuid, references auth.users)
      - `vote_type` (boolean)
      - `created_at` (timestamptz)
    - `deal_comments`
      - `id` (uuid, primary key)
      - `deal_id` (text)
      - `user_id` (uuid, references auth.users)
      - `content` (text)
      - `created_at` (timestamptz)

  2. Functions
    - `get_deal_vote_count`: Calculates total vote count for a deal

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Drop existing objects to avoid conflicts
DROP TABLE IF EXISTS deal_votes CASCADE;
DROP TABLE IF EXISTS deal_comments CASCADE;
DROP FUNCTION IF EXISTS get_deal_vote_count(text);

-- Create deal_votes table
CREATE TABLE deal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

-- Enable RLS for deal_votes
ALTER TABLE deal_votes ENABLE ROW LEVEL SECURITY;

-- Policies for deal_votes
CREATE POLICY "Users can read all votes"
  ON deal_votes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON deal_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON deal_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON deal_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create deal_comments table
CREATE TABLE deal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for deal_comments
ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;

-- Policies for deal_comments
CREATE POLICY "Anyone can read comments"
  ON deal_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON deal_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON deal_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON deal_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to get deal vote count
CREATE OR REPLACE FUNCTION get_deal_vote_count(deal_id text)
RETURNS bigint
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN vote_type THEN 1 ELSE -1 END),
    0
  )::bigint
  FROM deal_votes
  WHERE deal_votes.deal_id = $1;
$$;