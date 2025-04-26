/*
  # Add foreign key constraint to deal_comments table

  1. Changes
    - Clean up any orphaned comments that reference non-existent deals
    - Add foreign key constraint from deal_comments.deal_id to deals.id
    - This enables proper joins between deal_comments and deals tables
    - Ensures referential integrity for comments

  2. Security
    - No changes to RLS policies
    - Existing table permissions remain unchanged
*/

-- First, remove any orphaned comments that reference non-existent deals
DELETE FROM deal_comments
WHERE deal_id NOT IN (SELECT id FROM deals);

-- Now add the foreign key constraint
ALTER TABLE deal_comments
ADD CONSTRAINT deal_comments_deal_id_fkey
FOREIGN KEY (deal_id) REFERENCES deals(id)
ON DELETE CASCADE;