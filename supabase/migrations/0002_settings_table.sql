-- =============================================================================
-- Migration 0002: Business Settings table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with defaults
INSERT INTO public.business_settings (key, value) VALUES
  ('company', '{
    "name": "Jangir Brothers",
    "legal_name": "Jangir Brothers Furniture Pvt Ltd",
    "gst_number": "",
    "pan_number": "",
    "address": "",
    "city": "",
    "state": "",
    "pincode": "",
    "phone": "",
    "email": "",
    "logo_url": "",
    "invoice_prefix": "JB"
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings"
  ON public.business_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admin can update settings"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Only admin can insert settings"
  ON public.business_settings FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');
