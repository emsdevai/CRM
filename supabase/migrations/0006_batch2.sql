-- Batch 2: per-person discount + quotation title
-- Run this in the Supabase SQL editor

-- #11: Per-salesperson discount override
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_discount_pct NUMERIC;

-- #3: Quotation title / name
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS title TEXT;
