-- Store per-quotation billing and shipping address snapshots.
-- These are shown on the printed quotation/PDF.
-- Schema: { name, gst_number, phone, address, city, state, pincode }

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS billed_to  JSONB,
  ADD COLUMN IF NOT EXISTS shipped_to JSONB;
