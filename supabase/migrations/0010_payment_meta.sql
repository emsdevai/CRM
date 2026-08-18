-- Add payment_meta JSONB to store method-specific payment details:
--   UPI:           { utr: "..." }
--   Card:          { card_last4: "..." }
--   Bank Transfer: { bank_name: "...", ifsc: "...", account_last4: "..." }
--   Cheque:        { bank_name: "...", cheque_date: "YYYY-MM-DD" }

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_meta JSONB DEFAULT '{}'::jsonb;
