-- =============================================================================
-- Jangir Brothers CRM — Demo Seed Data
-- Run AFTER 0001 and 0002 migrations.
-- Replace the admin_id below with your actual auth user UID.
-- =============================================================================

DO $$
DECLARE
  admin_id        UUID := '656b1e13-8b63-4812-a451-39dfd222e168';

  -- Product IDs
  p_sofa_id       UUID := gen_random_uuid();
  p_bed_id        UUID := gen_random_uuid();
  p_dining_id     UUID := gen_random_uuid();
  p_wardrobe_id   UUID := gen_random_uuid();
  p_tv_unit_id    UUID := gen_random_uuid();
  p_chair_id      UUID := gen_random_uuid();
  p_study_id      UUID := gen_random_uuid();

  -- Lead IDs
  l1_id UUID := gen_random_uuid();
  l2_id UUID := gen_random_uuid();
  l3_id UUID := gen_random_uuid();
  l4_id UUID := gen_random_uuid();
  l5_id UUID := gen_random_uuid();

  -- Customer IDs
  c1_id UUID := gen_random_uuid();
  c2_id UUID := gen_random_uuid();

  -- Quotation IDs
  q1_id UUID := gen_random_uuid();
  q2_id UUID := gen_random_uuid();
  q3_id UUID := gen_random_uuid();

  -- Invoice IDs
  inv1_id UUID := gen_random_uuid();
  inv2_id UUID := gen_random_uuid();

BEGIN

-- ─────────────────────────────────────────────────────────────
-- 1. PRODUCTS
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.products
  (id, sku, name, category, subcategory, type, cost, price, gst_pct, margin_pct, stock, reorder_level, description, created_by)
VALUES
  (p_sofa_id,     'JB-SF-001', 'Royal Velvet 3-Seater Sofa',   'Sofas',     'L-Shape',   'existing',   18000, 32000, 18, 43.75, 8,  3,  '3-seater velvet sofa in royal blue. Solid sheesham wood frame with high-density foam cushions.',   admin_id),
  (p_bed_id,      'JB-BD-002', 'King Size Teak Platform Bed',  'Beds',      'King',      'existing',   24000, 42000, 18, 42.86, 5,  2,  'Solid teak king size bed with hydraulic storage. 78×72 inch mattress area.',                        admin_id),
  (p_dining_id,   'JB-DT-003', '6-Seater Marble Dining Set',   'Dining',    'Table+Chairs','existing', 35000, 65000, 18, 46.15, 3,  1,  'Italian marble top dining table with 6 cushioned chairs. Stainless steel legs.',                   admin_id),
  (p_wardrobe_id, 'JB-WD-004', 'Sliding Mirror Wardrobe 6ft',  'Storage',   'Wardrobe',  'existing',   12000, 22000, 18, 45.45, 12, 4,  '6-door sliding wardrobe with full-length mirror. Internal shelves + hanging space.',                admin_id),
  (p_tv_unit_id,  'JB-TV-005', 'Floating TV Unit with LED',    'Living',    'TV Unit',   'new',        8000,  14500, 18, 44.83, 15, 5,  'Wall-mounted TV unit up to 65 inch. Built-in LED strip lighting. 3 drawers.',                      admin_id),
  (p_chair_id,    'JB-CH-006', 'Ergonomic Office Chair',       'Office',    'Chair',     'existing',   4500,  8200,  18, 45.12, 20, 6,  'Mesh back ergonomic chair with lumbar support. Adjustable height and armrests.',                   admin_id),
  (p_study_id,    'JB-ST-007', 'L-Shape Study Table',          'Office',    'Desk',      'existing',   6000,  11000, 18, 45.45, 10, 3,  'L-shape corner study table with bookshelf. Laminate finish. 140×100cm.',                          admin_id)
ON CONFLICT (sku) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. LEADS (various stages)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.leads
  (id, name, phone, email, city, state, stage, source, assigned_to, interested_categories, estimated_value, notes)
VALUES
  (l1_id, 'Vikram Sharma',   '+91 94100 11223', 'vikram.sharma@gmail.com',   'Udaipur',   'Rajasthan', 'Contacted',         'Walk-in',     admin_id, ARRAY['Sofas','Living'],   45000, 'Interested in L-shape sofa and TV unit. Has new flat in Fatehpura. Follow up Saturday.'),
  (l2_id, 'Sunita Agarwal',  '+91 98290 44567', 'sunita.ag@yahoo.com',       'Udaipur',   'Rajasthan', 'Qualified',         'Referral',    admin_id, ARRAY['Beds','Storage'],   75000, 'Looking to furnish master bedroom + 2 kids rooms. Good budget. Referral from Rajesh Mehta.'),
  (l3_id, 'Rohit Patel',     '+91 77320 88901', 'rohit.patel@hotmail.com',   'Nathdwara', 'Rajasthan', 'Negotiation',       'Instagram',   admin_id, ARRAY['Dining','Living'],  90000, 'Wants marble dining set + sofa. Negotiating on 12% discount. Decision by month end.'),
  (l4_id, 'Priya Joshi',     '+91 90010 23456', 'priya.joshi@gmail.com',     'Chittorgarh','Rajasthan','New',               'Google Ads',  admin_id, ARRAY['Office'],           25000, 'Called about office setup. Needs 4 chairs and study tables. Will visit showroom this week.'),
  (l5_id, 'Mahesh Gupta',    '+91 88880 99001', 'mahesh.gupta@business.com', 'Udaipur',   'Rajasthan', 'Quotation Sent',    'WhatsApp',    admin_id, ARRAY['Beds','Dining'],   110000, 'Full home furnishing project. 3BHK. Quotation sent — awaiting approval from spouse.')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. CUSTOMERS (converted from leads)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.customers
  (id, lead_id, name, phone, email, city, state, total_spent, salesperson_id)
VALUES
  (c1_id, NULL, 'Rajesh Mehta',    '+91 98765 00112', 'rajesh.mehta@gmail.com',    'Udaipur', 'Rajasthan', 65000, admin_id),
  (c2_id, NULL, 'Kavita Singhvi',  '+91 93520 44678', 'kavita.singhvi@gmail.com',  'Udaipur', 'Rajasthan', 42000, admin_id)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. QUOTATIONS
-- ─────────────────────────────────────────────────────────────

-- Q1: Draft quote for lead Vikram Sharma
INSERT INTO public.quotations (id, lead_id, stage, subtotal, discount_total, gst_total, grand_total, notes, created_by)
VALUES (
  q1_id, l1_id, 'Draft',
  46500, 2325, 7956.90, 52131.90,
  'Royal velvet sofa + floating TV unit. Customer wants delivery by Diwali.',
  admin_id
) ON CONFLICT DO NOTHING;

INSERT INTO public.quotation_items
  (quotation_id, product_id, name, sku, qty, unit_price, discount_pct, gst_pct, line_base, line_discount, taxable, gst_amt, line_total, sort_order)
VALUES
  (q1_id, p_sofa_id,    'Royal Velvet 3-Seater Sofa', 'JB-SF-001', 1, 32000, 5, 18, 32000, 1600,  30400, 5472,   35872, 1),
  (q1_id, p_tv_unit_id, 'Floating TV Unit with LED',  'JB-TV-005', 1, 14500, 5, 18, 14500,  725,  13775, 2479.5, 16254.5, 2);

-- Q2: Sent quote for customer Rajesh Mehta
INSERT INTO public.quotations (id, customer_id, stage, subtotal, discount_total, gst_total, grand_total, notes, created_by)
VALUES (
  q2_id, c1_id, 'Converted',
  65000, 0, 11700, 76700,
  'King bed + wardrobe for master bedroom. Confirmed order.',
  admin_id
) ON CONFLICT DO NOTHING;

INSERT INTO public.quotation_items
  (quotation_id, product_id, name, sku, qty, unit_price, discount_pct, gst_pct, line_base, line_discount, taxable, gst_amt, line_total, sort_order)
VALUES
  (q2_id, p_bed_id,      'King Size Teak Platform Bed', 'JB-BD-002', 1, 42000, 0, 18, 42000, 0, 42000, 7560,   49560, 1),
  (q2_id, p_wardrobe_id, 'Sliding Mirror Wardrobe 6ft', 'JB-WD-004', 1, 22000, 0, 18, 22000, 0, 22000, 3960,   25960, 2);

-- Q3: Pending approval for lead Rohit Patel (12% discount triggers approval)
INSERT INTO public.quotations (id, lead_id, stage, subtotal, discount_total, gst_total, grand_total, notes, created_by)
VALUES (
  q3_id, l3_id, 'Pending Approval',
  97000, 11640, 15393.12, 100753.12,
  'Marble dining set + 3-seater sofa. 12% discount requested — needs manager approval.',
  admin_id
) ON CONFLICT DO NOTHING;

INSERT INTO public.quotation_items
  (quotation_id, product_id, name, sku, qty, unit_price, discount_pct, gst_pct, line_base, line_discount, taxable, gst_amt, line_total, sort_order)
VALUES
  (q3_id, p_dining_id, '6-Seater Marble Dining Set',  'JB-DT-003', 1, 65000, 12, 18, 65000, 7800, 57200, 10296, 67496, 1),
  (q3_id, p_sofa_id,   'Royal Velvet 3-Seater Sofa',  'JB-SF-001', 1, 32000, 12, 18, 32000, 3840, 28160, 5068.8, 33228.8, 2);

-- ─────────────────────────────────────────────────────────────
-- 5. INVOICES (from converted quotation)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.invoices
  (id, invoice_no, quotation_id, customer_id, subtotal, discount_total, gst_total, grand_total, payment_status, salesperson_id, invoice_date)
VALUES
  (inv1_id, 'JB/2026/0001', q2_id, c1_id, 65000, 0, 11700, 76700, 'Paid',            admin_id, now() - interval '15 days'),
  (inv2_id, 'JB/2026/0002', NULL,  c2_id, 42000, 2100, 7182, 47082, 'Partially Paid', admin_id, now() - interval '5 days')
ON CONFLICT (invoice_no) DO NOTHING;

INSERT INTO public.invoice_items (invoice_id, product_id, name, sku, qty, unit_price, discount_pct, gst_pct, line_total)
VALUES
  (inv1_id, p_bed_id,      'King Size Teak Platform Bed', 'JB-BD-002', 1, 42000, 0,  18, 49560),
  (inv1_id, p_wardrobe_id, 'Sliding Mirror Wardrobe 6ft', 'JB-WD-004', 1, 22000, 0,  18, 25960),
  (inv2_id, p_chair_id,    'Ergonomic Office Chair',      'JB-CH-006', 4, 8200,  5,  18, 30832),
  (inv2_id, p_study_id,    'L-Shape Study Table',         'JB-ST-007', 1, 11000, 5,  18, 12353.7);

-- Update total_spent on customers
UPDATE public.customers SET total_spent = 76700  WHERE id = c1_id;
UPDATE public.customers SET total_spent = 42000  WHERE id = c2_id;

-- Lead activities log
INSERT INTO public.lead_activities (lead_id, type, text, by)
VALUES
  (l1_id, 'created', 'Lead created from walk-in enquiry at showroom.',             admin_id),
  (l1_id, 'call',    'Called customer. Interested in royal blue sofa + TV unit.',  admin_id),
  (l1_id, 'quote',   'Draft quotation created for ₹52,131.',                       admin_id),
  (l2_id, 'created', 'Referral lead from Rajesh Mehta.',                           admin_id),
  (l2_id, 'call',    'Discussed bedroom set requirements. Visiting Saturday.',     admin_id),
  (l3_id, 'created', 'Lead from Instagram DM about dining set.',                   admin_id),
  (l3_id, 'note',    'Customer firm on 12% discount. Submitted for approval.',     admin_id),
  (l5_id, 'quote',   'Full home furnishing quotation sent over WhatsApp.',         admin_id);

RAISE NOTICE 'Seed data inserted successfully!';

END $$;
