-- Configurable attendance clock-in / clock-out times.
-- clock_in_time : "HH:MM" string; employees arriving after this are marked Late.
-- clock_out_time: "HH:MM" string; expected end-of-day (informational for now).

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS clock_in_time  TEXT NOT NULL DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS clock_out_time TEXT NOT NULL DEFAULT '17:30';
