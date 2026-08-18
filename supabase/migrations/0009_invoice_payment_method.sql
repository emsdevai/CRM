-- Add payment method fields to invoices
-- payment_method: how the invoice was paid
-- payment_card_type: only relevant when payment_method = 'Card'

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method   TEXT,
  ADD COLUMN IF NOT EXISTS payment_card_type TEXT;
