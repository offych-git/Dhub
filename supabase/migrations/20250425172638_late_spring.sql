/*
  # Add expires_at column to deals table

  1. Changes
    - Add `expires_at` column to `deals` table
      - Type: timestamptz (timestamp with time zone)
      - Nullable: true (not all deals have expiration dates)
      - Default: null

  2. Notes
    - Using IF NOT EXISTS to prevent errors if column already exists
    - Using DO block for safe column addition
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE deals ADD COLUMN expires_at timestamptz;
  END IF;
END $$;