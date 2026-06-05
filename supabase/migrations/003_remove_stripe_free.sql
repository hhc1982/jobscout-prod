-- ═══════════════════════════════════════════════════════════
--  JobScout — Migration 003: Remove Stripe, Make App Free
--  Run this in: supabase.com → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- Step 1: Drop Stripe columns from profiles (no longer needed)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS subscribed_at;

-- Step 2: Replace the new user trigger — no more trial logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
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

-- Step 3: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 4: Backfill — ensure all existing auth users have a profile row
INSERT INTO public.profiles (
  id, email, full_name,
  notify_daily_digest, notify_new_matches, digest_time,
  cv_target_roles, cv_skills, cv_locations, cv_industries, job_search_queries
)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  true, true, '06:00',
  ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]
FROM auth.users
ON CONFLICT (id) DO NOTHING;
