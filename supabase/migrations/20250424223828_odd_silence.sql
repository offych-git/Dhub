-- Create promo votes table
CREATE TABLE promo_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promo_id, user_id)
);

-- Enable RLS
ALTER TABLE promo_votes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read promo votes"
  ON promo_votes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create promo votes"
  ON promo_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own promo votes"
  ON promo_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own promo votes"
  ON promo_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX promo_votes_promo_id_idx ON promo_votes(promo_id);
CREATE INDEX promo_votes_user_id_idx ON promo_votes(user_id);
CREATE INDEX promo_votes_created_at_idx ON promo_votes(created_at DESC);