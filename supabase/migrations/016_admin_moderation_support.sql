-- Migration: 016_admin_moderation_support.sql
-- Add is_banned column to public.profiles if not present
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;
