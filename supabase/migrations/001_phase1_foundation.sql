-- ============================================================
-- Private Voices — Phase 1 Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS (extends Supabase auth.users) ────────────────────────────────────────

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
);

-- Index for profile lookup by username (e.g. /@username)
CREATE UNIQUE INDEX profiles_username_idx ON public.profiles (LOWER(username));

-- ─── PRIVACY SETTINGS ───────────────────────────────────────────────────────────

CREATE TYPE visibility_anyone_followers_nobody AS ENUM ('anyone', 'followers', 'nobody');
CREATE TYPE story_visibility_type AS ENUM ('everyone', 'followers', 'close_friends', 'custom');

CREATE TABLE public.privacy_settings (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Who can interact with this user
  who_can_follow            visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  who_can_message           visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  whisper_visibility        visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  story_visibility          story_visibility_type NOT NULL DEFAULT 'everyone',
  who_can_comment           visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  who_can_mention           visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',

  -- Discovery
  show_in_recommendations   BOOLEAN NOT NULL DEFAULT TRUE,
  allow_profile_indexing    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── FOLLOWS ────────────────────────────────────────────────────────────────────

CREATE TABLE public.follows (
  follower_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX follows_follower_idx  ON public.follows (follower_id);
CREATE INDEX follows_following_idx ON public.follows (following_id);

-- ─── TRIGGERS: auto-update updated_at ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER privacy_settings_updated_at
  BEFORE UPDATE ON public.privacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRIGGER: auto-create privacy_settings on new profile ───────────────────────

CREATE OR REPLACE FUNCTION create_default_privacy_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.privacy_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_privacy_settings();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────────

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows         ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can read public profiles; only owner can update
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (TRUE);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- privacy_settings: only owner can read/update
CREATE POLICY "Users can view their own privacy settings"
  ON public.privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings"
  ON public.privacy_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- follows: anyone can read; only the follower can insert/delete their own follows
CREATE POLICY "Follows are publicly readable"
  ON public.follows FOR SELECT USING (TRUE);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ─── FUNCTION: create profile on sign-up ────────────────────────────────────────
-- Called by the NestJS API after Supabase Auth sign-up.
-- This is NOT a trigger on auth.users (Supabase discourages that pattern).
-- The API calls this directly with the user's chosen username.

CREATE OR REPLACE FUNCTION public.create_profile(
  p_user_id     UUID,
  p_username    TEXT,
  p_display_name TEXT
)
RETURNS public.profiles AS $$
DECLARE
  new_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (p_user_id, p_username, p_display_name)
  RETURNING * INTO new_profile;

  RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
