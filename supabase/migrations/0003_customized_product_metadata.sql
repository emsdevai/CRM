-- =============================================================================
-- Migration 0003: Add metadata JSONB column to products for customized product fields
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.products.metadata IS
  'Stores customized-product-specific fields: color, dimensions, pickup_charge, installation_charge, delivery_days, customization_details';
