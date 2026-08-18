-- Add freight charges to quotations (mirrors the invoices table)
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS freight_charges NUMERIC DEFAULT 0 NOT NULL;
