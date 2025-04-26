/*
  # Add display_name column to profiles table

  1. Changes
    - Add display_name column to profiles table
    - Set default display_name from email
    - Add index for better performance
*/

-- Add display_name column if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name text;

-- Update existing profiles to set display_name from email
UPDATE profiles 
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name IS NULL;

-- Create index for display_name
CREATE INDEX IF NOT EXISTS profiles_display_name_idx ON profiles(display_name);