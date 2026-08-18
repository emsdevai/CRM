-- Store per-invoice billing and shipping address snapshots.
-- These override the customer's current address on the printed invoice/PDF.
-- Schema: { name, gst_number, phone, address, city, state, pincode }

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billed_to  JSONB,
  ADD COLUMN IF NOT EXISTS shipped_to JSONB;
