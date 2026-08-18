-- Store settings: singleton row for shop-wide configuration.
-- Currently used for geofence attendance; extend for other settings later.

CREATE TABLE IF NOT EXISTS public.store_settings (
  id         SMALLINT PRIMARY KEY DEFAULT 1,
  -- Geofence
  geo_check_enabled  BOOLEAN          NOT NULL DEFAULT false,
  geo_strict_mode    BOOLEAN          NOT NULL DEFAULT false,  -- true = block non-admins; false = warn only
  store_latitude     DOUBLE PRECISION,
  store_longitude    DOUBLE PRECISION,
  radius_meters      INTEGER          NOT NULL DEFAULT 200,
  -- Audit
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT  store_settings_singleton CHECK (id = 1)
);

-- Seed the single row so it always exists
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
