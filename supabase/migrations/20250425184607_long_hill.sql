/*
  # Add admin role and functionality
  
  1. Changes
    - Add is_admin column to profiles table
    - Add admin policies for managing content
    - Add user_status column for banning users
    
  2. Security
    - Only admins can manage other users
    - Admins can delete any content
*/

-- Add admin and status columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS user_status text DEFAULT 'active' CHECK (user_status IN ('active', 'banned'));

-- Create admin policies for deals
CREATE POLICY "Admins can delete any deal"
  ON deals
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create admin policies for promo_codes
CREATE POLICY "Admins can delete any promo"
  ON promo_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create admin policies for deal_comments
CREATE POLICY "Admins can delete any deal comment"
  ON deal_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create admin policies for promo_comments
CREATE POLICY "Admins can delete any promo comment"
  ON promo_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND user_status = 'banned'
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing policies to check for banned status
CREATE OR REPLACE FUNCTION check_user_can_write()
RETURNS boolean AS $$
BEGIN
  RETURN (
    -- User must be authenticated
    auth.role() = 'authenticated' AND
    -- User must not be banned
    NOT is_user_banned(auth.uid())
  );
END;
$$ LANGUAGE plpgsql;

-- Apply the check to all write policies
ALTER POLICY "Users can create their own deals" ON deals
WITH CHECK (
  check_user_can_write() AND auth.uid() = user_id
);

ALTER POLICY "Users can create promo codes" ON promo_codes
WITH CHECK (
  check_user_can_write() AND auth.uid() = user_id
);

ALTER POLICY "Users can create comments" ON deal_comments
WITH CHECK (
  check_user_can_write() AND auth.uid() = user_id
);

ALTER POLICY "Users can create comments" ON promo_comments
WITH CHECK (
  check_user_can_write() AND auth.uid() = user_id
);