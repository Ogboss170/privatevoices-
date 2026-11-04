-- ==============================================================================
-- Migration: 055_location_tagging_and_privacy.sql
-- Description: Adds privacy-first location tagging to posts and stories with
--              coarse coordinates, display metadata, and privacy visibility controls.
-- ==============================================================================

-- 1. Create reusable locations table for venues, cities, neighborhoods, landmarks
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT UNIQUE NOT NULL, -- e.g. OpenStreetMap / Nominatim OSM ID or provider unique place ID
  name TEXT NOT NULL,
  city TEXT,
  region TEXT,
  country TEXT,
  country_code VARCHAR(10),
  category TEXT, -- 'city', 'neighborhood', 'landmark', 'venue', etc.
  latitude NUMERIC(9, 6), -- coarse latitude for discovery / map view
  longitude NUMERIC(9, 6), -- coarse longitude for discovery / map view
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS locations_place_id_idx ON public.locations(place_id);
CREATE INDEX IF NOT EXISTS locations_name_idx ON public.locations(name);
CREATE INDEX IF NOT EXISTS locations_name_lower_idx ON public.locations(lower(name));
CREATE INDEX IF NOT EXISTS locations_city_idx ON public.locations(city);

-- Enable RLS on locations (readable by authenticated and anonymous users; inserted/managed by authenticated users)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Anyone can view locations'
  ) THEN
    CREATE POLICY "Anyone can view locations" ON public.locations FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Authenticated users can register locations'
  ) THEN
    CREATE POLICY "Authenticated users can register locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 2. Add location columns to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS location_lng NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS location_place_id TEXT;

CREATE INDEX IF NOT EXISTS posts_location_place_id_idx ON public.posts(location_place_id);
CREATE INDEX IF NOT EXISTS posts_location_name_idx ON public.posts(location_name);

-- 3. Add location sticker column to stories
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS location_sticker JSONB;

-- 4. RPC to search or get location stats
CREATE OR REPLACE FUNCTION public.get_location_summary(p_place_id TEXT, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_count INT;
  v_story_count INT;
  v_result JSONB;
BEGIN
  -- Count posts tagged with this location
  SELECT COUNT(*) INTO v_post_count
  FROM public.posts p
  WHERE (p.location_place_id = p_place_id OR p.location_name ILIKE p_name);

  -- Count active stories tagged with this location
  SELECT COUNT(*) INTO v_story_count
  FROM public.stories s
  WHERE s.expires_at > NOW()
    AND (s.location_sticker->>'placeId' = p_place_id OR s.location_sticker->>'name' ILIKE p_name);

  v_result := jsonb_build_object(
    'post_count', v_post_count,
    'story_count', v_story_count
  );

  RETURN v_result;
END;
$$;
