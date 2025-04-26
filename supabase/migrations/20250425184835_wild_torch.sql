-- Make the current user an admin
UPDATE profiles 
SET is_admin = true 
WHERE id = auth.uid();