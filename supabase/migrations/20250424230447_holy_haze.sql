/*
  # Add deal URL column to deals table

  1. Changes
    - Add `deal_url` column to `deals` table
    - Set default values for existing rows
    - Make column NOT NULL after data migration
    
  2. Notes
    - Column will store URLs where users can find and purchase the deals
    - Existing rows will get a placeholder URL
*/

DO $$ 
BEGIN
  -- First add the column as nullable
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'deal_url'
  ) THEN
    -- Add column as nullable first
    ALTER TABLE deals ADD COLUMN deal_url text;
    
    -- Update existing rows with a placeholder value
    UPDATE deals SET deal_url = 'https://example.com/deal/' || id WHERE deal_url IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE deals ALTER COLUMN deal_url SET NOT NULL;
  END IF;
END $$;