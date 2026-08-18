-- Migration 0005: HSN codes, freight charges, payment mode, customer GST/pincode
-- Run this in Supabase Dashboard → SQL Editor

-- HSN code on products (for tax invoice compliance)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- HSN code on invoice_items (captured at invoice creation time)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- GST registration number + pincode on customers (optional, for Billed To block)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Freight / carrier charges on invoices (excluding GST, shown in totals)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS freight_charges NUMERIC DEFAULT 0 NOT NULL;

-- Payment mode: Cash / UPI / Card / Bank Transfer
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_mode TEXT;

-- Reference / transaction ID for UPI / Card / Bank Transfer
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Card surcharge percentage (e.g. 2 = 2%)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS card_surcharge_pct NUMERIC DEFAULT 0 NOT NULL;
