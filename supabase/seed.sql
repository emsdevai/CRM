-- =============================================================================
-- Jangir Brothers CRM – Development Seed
-- Run AFTER creating all Supabase Auth users manually (or via admin API).
-- This seeds mock profiles + products + leads for development/demo.
--
-- IMPORTANT: Create auth users first in Supabase Dashboard → Authentication
-- Use these email/password combos for testing:
--   admin@jangirbrothers.com / Admin@123
--   manager1@jangirbrothers.com / Manager@123
--   sp1@jangirbrothers.com / Sales@123
-- =============================================================================

-- NOTE: Replace these UUIDs with actual auth.users UUIDs after creating them.
-- You can get them from Supabase Dashboard → Authentication → Users

-- Seed discount rules (safe to run always)
INSERT INTO public.discount_rules (role, min_pct, max_pct, requires_approval_above) VALUES
  ('salesperson', 0, 10, 10),
  ('manager',     0, 15, 15),
  ('admin',       0, 100, 100)
ON CONFLICT (role) DO UPDATE SET
  min_pct = EXCLUDED.min_pct,
  max_pct = EXCLUDED.max_pct,
  requires_approval_above = EXCLUDED.requires_approval_above;

-- Seed products (furniture catalog)
INSERT INTO public.products (
  name, sku, barcode, category, subcategory, family, type,
  cost, price, gst_pct, margin_pct, stock, reorder_level, description
) VALUES
  -- Living Room
  ('Milano 3-Seater Sofa',          'LI-SOF-1001', '1234567890001', 'Living Room', 'Sofas',         'Fabric Upholstered', 'existing', 18000, 32000, 18, 43.75, 8,  4, 'Premium 3-seater sofa in fabric upholstery. 1 year warranty, free assembly.'),
  ('Aurora L-Shape Sectional',      'LI-SOF-1002', '1234567890002', 'Living Room', 'Sofas',         'Fabric Upholstered', 'existing', 28000, 52000, 18, 46.15, 3,  2, 'L-shaped sectional sofa, perfect for large living rooms.'),
  ('Bristol 2-Seater Sofa',         'LI-SOF-1003', '1234567890003', 'Living Room', 'Sofas',         'Fabric Upholstered', 'existing', 12000, 22000, 18, 45.45, 5,  3, 'Compact 2-seater sofa in premium fabric.'),
  ('Cruz Single Recliner',          'LI-REC-1004', '1234567890004', 'Living Room', 'Recliners',     'Leatherette',         'existing', 10000, 18000, 18, 44.44, 6,  3, 'Single recliner in leatherette with footrest.'),
  ('Oakridge Coffee Table',         'LI-COF-1005', '1234567890005', 'Living Room', 'Coffee Tables', 'Sheesham Wood',       'existing',  5000,  9500, 18, 47.37, 12, 5, 'Solid sheesham wood coffee table.'),
  ('Vega TV Console',               'LI-TVU-1006', '1234567890006', 'Living Room', 'TV Units',      'Engineered Wood',     'existing',  8000, 14500, 18, 44.83, 7,  3, 'Wall-mounted TV console with storage.'),
  -- Bedroom
  ('Windsor King Bed',              'BE-BED-1007', '1234567890007', 'Bedroom',     'Beds',          'Sheesham Wood',       'existing', 22000, 40000, 18, 45.00, 4,  2, 'King-size bed in solid sheesham wood with storage.'),
  ('Alpine Queen Bed with Storage', 'BE-BED-1008', '1234567890008', 'Bedroom',     'Beds',          'Sheesham Wood',       'existing', 18000, 34000, 18, 47.06, 3,  2, 'Queen-size storage bed.'),
  ('Metro 3-Door Wardrobe',         'BE-WAR-1009', '1234567890009', 'Bedroom',     'Wardrobes',     'Engineered Wood',     'existing', 15000, 28000, 18, 46.43, 5,  3, '3-door wardrobe with mirror and organizer.'),
  ('Ivy Dresser with Mirror',       'BE-DRE-1010', '1234567890010', 'Bedroom',     'Dressers',      'Engineered Wood',     'existing',  9000, 17000, 18, 47.06, 4,  2, 'Dresser with large mirror and 4 drawers.'),
  -- Dining
  ('Provence 6-Seater Dining Table','DI-DTA-1011', '1234567890011', 'Dining',      'Dining Tables', 'Sheesham Wood',       'existing', 24000, 42000, 18, 42.86, 3,  2, '6-seater dining table in solid sheesham.'),
  ('Nordic Dining Chair (Set of 2)','DI-DCH-1012', '1234567890012', 'Dining',      'Dining Chairs', 'Metal & Glass',       'existing',  4000,  7500, 18, 46.67, 16, 6, 'Set of 2 Nordic dining chairs in metal frame.'),
  -- Office
  ('ErgoFlex Office Chair',         'OF-OCH-1013', '1234567890013', 'Office',      'Office Chairs', 'Mesh & Metal',        'existing',  8000, 15000, 18, 46.67, 10, 4, 'Ergonomic mesh office chair with lumbar support.'),
  ('Executive High-Back Chair',     'OF-OCH-1014', '1234567890014', 'Office',      'Office Chairs', 'Mesh & Metal',        'existing', 12000, 22000, 18, 45.45, 6,  3, 'Premium executive chair in leatherette.'),
  ('Summit Office Desk',            'OF-ODE-1015', '1234567890015', 'Office',      'Office Desks',  'Engineered Wood',     'existing',  9000, 17000, 18, 47.06, 8,  4, 'Large office desk with cable management.'),
  ('Horizon 5-Tier Bookshelf',      'OF-BOO-1016', '1234567890016', 'Office',      'Bookshelves',   'Engineered Wood',     'existing',  6000, 11000, 18, 45.45, 9,  4, '5-tier open bookshelf in warm walnut finish.'),
  -- Outdoor
  ('Bali Patio 4-Seater Set',       'OU-PAT-1017', '1234567890017', 'Outdoor',     'Patio Sets',    'Rattan / Cane',       'existing', 18000, 32000, 12, 43.75, 2,  2, '4-seater patio set in all-weather rattan.'),
  -- Storage
  ('Stackable Shoe Cabinet',        'ST-SHO-1018', '1234567890018', 'Storage',     'Shoe Racks',    'Engineered Wood',     'existing',  3500,  6500, 18, 46.15, 15, 6, 'Stackable shoe cabinet with 3 compartments.'),
  -- Decor
  ('Halo Wall Mirror',              'DE-MIR-1019', '1234567890019', 'Decor',       'Mirrors',       'Metal & Glass',       'existing',  4500,  8500, 12, 47.06, 10, 4, 'Large round wall mirror with metal frame.'),
  ('Aria Floor Lamp',               'DE-LAM-1020', '1234567890020', 'Decor',       'Lamps',         'Metal & Glass',       'existing',  3000,  5500, 12, 45.45, 8,  4, 'Contemporary arc floor lamp in brushed gold.')
ON CONFLICT (sku) DO NOTHING;

-- ✅ After running this seed, verify in Supabase Table Editor that:
--    1. products table has 20 rows
--    2. discount_rules has 3 rows (salesperson, manager, admin)
--    3. business_settings has the company settings row
