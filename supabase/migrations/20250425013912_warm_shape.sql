/*
  # Restore deals, promo codes and comments

  1. Data Restoration
    - Restore previously created deals
    - Restore promo codes
    - Restore comments and votes
    
  2. Security
    - Maintain existing RLS policies
*/

-- Insert deals
INSERT INTO deals (
  id,
  title,
  description,
  current_price,
  original_price,
  image_url,
  store_id,
  category_id,
  deal_url,
  user_id,
  created_at
) VALUES
  (
    'restored-deal-1',
    'iPhone 15 Pro Max',
    'Latest iPhone with 256GB storage and ProMotion display',
    999.99,
    1199.99,
    'https://images.pexels.com/photos/5750001/pexels-photo-5750001.jpeg',
    'Apple Store',
    'electronics',
    'https://apple.com/iphone-15-pro',
    (SELECT id FROM profiles LIMIT 1),
    NOW() - INTERVAL '2 hours'
  ),
  (
    'restored-deal-2',
    'Samsung 65" OLED TV',
    'Premium 4K OLED TV with HDR and Smart features',
    1499.99,
    1999.99,
    'https://images.pexels.com/photos/6976094/pexels-photo-6976094.jpeg',
    'Best Buy',
    'electronics',
    'https://bestbuy.com/samsung-oled',
    (SELECT id FROM profiles LIMIT 1),
    NOW() - INTERVAL '3 hours'
  );

-- Insert promo codes
INSERT INTO promo_codes (
  code,
  title,
  description,
  category_id,
  discount_url,
  expires_at,
  user_id,
  created_at
) VALUES
  (
    'SPRING25',
    'Spring Sale 25% Off',
    'Get 25% off on all spring collection items',
    'clothing',
    'https://example.com/spring-sale',
    NOW() + INTERVAL '7 days',
    (SELECT id FROM profiles LIMIT 1),
    NOW() - INTERVAL '1 hour'
  ),
  (
    'TECH100',
    '$100 Off Electronics',
    'Save $100 on purchases over $500',
    'electronics',
    'https://example.com/tech-sale',
    NOW() + INTERVAL '5 days',
    (SELECT id FROM profiles LIMIT 1),
    NOW() - INTERVAL '2 hours'
  );

-- Insert comments for deals
INSERT INTO deal_comments (
  deal_id,
  user_id,
  content,
  created_at
) VALUES
  (
    'restored-deal-1',
    (SELECT id FROM profiles LIMIT 1),
    'Great deal! Just ordered one.',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    'restored-deal-2',
    (SELECT id FROM profiles LIMIT 1),
    'Amazing price for this TV model!',
    NOW() - INTERVAL '45 minutes'
  );

-- Insert comments for promo codes
INSERT INTO promo_comments (
  promo_id,
  user_id,
  content,
  created_at
) VALUES
  (
    (SELECT id FROM promo_codes WHERE code = 'SPRING25'),
    (SELECT id FROM profiles LIMIT 1),
    'Code works perfectly, got my discount!',
    NOW() - INTERVAL '15 minutes'
  ),
  (
    (SELECT id FROM promo_codes WHERE code = 'TECH100'),
    (SELECT id FROM profiles LIMIT 1),
    'Used this for a new laptop, great savings!',
    NOW() - INTERVAL '20 minutes'
  );

-- Add some votes
INSERT INTO deal_votes (
  deal_id,
  user_id,
  vote_type,
  created_at
) VALUES
  (
    'restored-deal-1',
    (SELECT id FROM profiles LIMIT 1),
    true,
    NOW() - INTERVAL '25 minutes'
  ),
  (
    'restored-deal-2',
    (SELECT id FROM profiles LIMIT 1),
    true,
    NOW() - INTERVAL '35 minutes'
  );

INSERT INTO promo_votes (
  promo_id,
  user_id,
  vote_type,
  created_at
) VALUES
  (
    (SELECT id FROM promo_codes WHERE code = 'SPRING25'),
    (SELECT id FROM profiles LIMIT 1),
    true,
    NOW() - INTERVAL '10 minutes'
  ),
  (
    (SELECT id FROM promo_codes WHERE code = 'TECH100'),
    (SELECT id FROM profiles LIMIT 1),
    true,
    NOW() - INTERVAL '15 minutes'
  );