-- ═══════════════════════════════════════════════════════════
--  JobScout — Fix user creation trigger
--  Run this in Supabase SQL Editor after 001_schema.sql
-- ═══════════════════════════════════════════════════════════

-- Drop and recreate the trigger to include trial setup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    subscription_status,
    trial_ends_at,
    notify_daily_digest,
    notify_new_matches,
    digest_time,
    cv_target_roles,
    cv_skills,
    cv_locations,
    cv_industries,
    job_search_queries
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'trial',
    NOW() + INTERVAL '7 days',
    true,
    true,
    '06:00',
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Fix existing users who signed up before this trigger was in place
INSERT INTO public.profiles (
  id, email, full_name, subscription_status, trial_ends_at,
  notify_daily_digest, notify_new_matches, digest_time,
  cv_target_roles, cv_skills, cv_locations, cv_industries, job_search_queries
)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  'trial',
  NOW() + INTERVAL '7 days',
  true, true, '06:00',
  ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  subscription_status = CASE 
    WHEN profiles.subscription_status = 'active' THEN 'active'
    ELSE 'trial'
  END,
  trial_ends_at = CASE
    WHEN profiles.subscription_status = 'active' THEN profiles.trial_ends_at
    WHEN profiles.trial_ends_at < NOW() THEN NOW() + INTERVAL '7 days'
    ELSE profiles.trial_ends_at
  END;
