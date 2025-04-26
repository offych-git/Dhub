/*
  # Add subcategories column to deals table

  1. Changes
    - Add subcategories column to deals table as a text array
    - Set default value to empty array
    
  2. Description
    This migration adds support for multiple subcategories per deal
*/

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';