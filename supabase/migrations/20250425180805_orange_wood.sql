/*
  # Add notifications system
  
  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text) - mention, reply, etc.
      - `content` (text)
      - `source_type` (text) - deal_comment, promo_comment
      - `source_id` (text) - ID of the source item
      - `actor_id` (uuid) - User who triggered the notification
      - `read` (boolean)
      - `created_at` (timestamptz)

  2. Changes
    - Add notification_preferences to profiles table
    
  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('mention', 'reply', 'vote', 'favorite')),
  content text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('deal_comment', 'promo_comment', 'deal', 'promo')),
  source_id text NOT NULL,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add notification preferences to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN notification_preferences jsonb DEFAULT jsonb_build_object(
      'mentions', true,
      'replies', true,
      'votes', true,
      'favorites', true,
      'email_notifications', true
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX notifications_user_id_idx ON notifications(user_id);
CREATE INDEX notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX notifications_read_idx ON notifications(read);