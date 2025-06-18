-- Add language column to profiles table
-- This will store user's preferred language for push notifications

-- Add the language column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru';

-- Create an index for better performance when filtering by language
CREATE INDEX IF NOT EXISTS idx_profiles_language ON profiles(language);

-- Update existing users with default language based on some logic
-- You can customize this based on your needs

-- Set language to 'ru' for users who haven't set it yet
UPDATE profiles 
SET language = 'ru' 
WHERE language IS NULL;

-- Optional: Set language based on user's email domain or other criteria
-- UPDATE profiles SET language = 'en' WHERE email LIKE '%@gmail.com';
-- UPDATE profiles SET language = 'es' WHERE email LIKE '%@hotmail.es';

-- Add a comment to the column
COMMENT ON COLUMN profiles.language IS 'User preferred language for notifications (ru, en, es, etc.)';

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'language'; 