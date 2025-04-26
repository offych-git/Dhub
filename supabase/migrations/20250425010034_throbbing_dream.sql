/*
  # Add subcategories column to deals and promo_codes tables

  1. Changes
    - Add subcategories column to deals table
    - Add subcategories column to promo_codes table
    
  2. Description
    This migration adds support for multiple subcategories per deal/promo
*/

-- Add subcategories column to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';

-- Add subcategories column to promo_codes table
ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS subcategories text[] DEFAULT '{}';