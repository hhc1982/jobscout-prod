-- ═══════════════════════════════════════════════════════════
--  JobScout — Supabase Database Schema
--  Run this in: supabase.com → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────
create table public.profiles (
  id              uuid references auth.users on delete cascade primary key,
  email           text,
  full_name       text,
  avatar_url      text,

  -- CV Profile
  cv_headline     text,
  cv_target_roles text[],
  cv_skills       text[],
  cv_locations    text[],
  cv_industries   text[],

  -- Salary fields (all in SGD)
  salary_current  integer,           -- current salary (private)
  salary_min      integer,           -- target range min
  salary_max      integer,           -- target range max
  salary_ask      integer,           -- negotiation ask (private)

  -- Subscription
  stripe_customer_id    text,
  stripe_subscription_id text,
  subscription_status   text default 'trial',  -- trial | active | cancelled | expired
  trial_ends_at         timestamptz default (now() + interval '7 days'),
  subscribed_at         timestamptz,

  -- Preferences
  notify_daily_digest   boolean default true,
  notify_new_matches    boolean default true,
  digest_time           text default '06:00',   -- SGT
  job_search_queries    text[],

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── CV FILES ─────────────────────────────────────────────────
create table public.cv_files (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles on delete cascade,
  type            text not null,  -- base | tailored | best_practice
  label           text,           -- e.g. "Grab VP Sales" or "Best Practice v1"
  file_url        text,           -- Supabase Storage URL
  file_name       text,
  parsed_content  jsonb,          -- AI-extracted structured content
  job_id          uuid,           -- if tailored, which job
  is_base         boolean default false,
  created_at      timestamptz default now()
);

-- ── JOBS (shortlisted + searched) ────────────────────────────
create table public.jobs (
  id              uuid default uuid_generate_v4() primary key,
  external_id     text,           -- Adzuna/MCF job ID
  source          text,           -- adzuna | mcf | jobsdb | linkedin | indeed
  title           text not null,
  company         text,
  location        text,
  description     text,
  url             text,
  salary_min      integer,
  salary_max      integer,
  salary_currency text default 'SGD',
  tags            text[],
  posted_at       timestamptz,
  fetched_at      timestamptz default now(),
  unique(external_id, source)
);

-- ── SHORTLISTED JOBS (per user) ──────────────────────────────
create table public.shortlisted_jobs (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles on delete cascade,
  job_id          uuid references public.jobs on delete cascade,
  match_score     integer,        -- 0-100
  match_reasons   text[],         -- why it matched
  batch_date      date default current_date,
  dismissed       boolean default false,
  actioned        boolean default false,
  created_at      timestamptz default now(),
  unique(user_id, job_id, batch_date)
);

-- ── APPLICATIONS ─────────────────────────────────────────────
create table public.applications (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles on delete cascade,
  job_id          uuid references public.jobs,

  -- Manual fields (if not from job board)
  company         text,
  role            text,
  job_url         text,
  notes           text,

  -- Stage
  stage           text default 'wishlist',
  -- wishlist | applied | screening | interviewing | offer | rejected | withdrawn

  -- Matching
  match_score     integer,

  -- CV used
  cv_file_id      uuid references public.cv_files,
  cover_letter    text,           -- AI-generated, editable

  -- Auto-apply
  apply_level     integer,        -- 1 | 2 | 3
  applied_at      timestamptz,
  applied_via     text,           -- manual | auto_level1 | auto_level2

  -- Dates
  date_saved      date default current_date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── INTERVIEWS ───────────────────────────────────────────────
create table public.interviews (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles on delete cascade,
  application_id  uuid references public.applications on delete set null,
  company         text not null,
  role            text not null,
  interview_date  date,
  interview_time  time,
  stage           text,           -- Phone Screen | Technical | Final | etc
  format          text,           -- Video | Phone | In-Person | Take-Home
  interviewer     text,
  notes           text,
  gcal_event_id   text,           -- Google Calendar event ID
  reminder_sent   boolean default false,
  screenshot_url  text,           -- if created from screenshot
  created_at      timestamptz default now()
);

-- ── RESEARCH ─────────────────────────────────────────────────
create table public.research (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles on delete cascade,
  interview_id    uuid references public.interviews on delete cascade,
  company         text,
  role            text,
  company_overview    text,
  company_recent      text,
  role_breakdown      text,
  role_looking_for    text,
  domain_context      text,
  interview_questions text,
  talking_points      text,
  salary_intel        text,
  generated_at    timestamptz default now()
);

-- ── SALARY INTEL (cached market data) ────────────────────────
create table public.salary_intel (
  id              uuid default uuid_generate_v4() primary key,
  role_title      text,
  company         text,
  location        text default 'Singapore',
  seniority       text,           -- junior | mid | senior | director | vp | c-suite
  salary_min      integer,
  salary_max      integer,
  salary_median   integer,
  currency        text default 'SGD',
  source          text,           -- glassdoor | linkedin | mom | levels_fyi | claude_estimate
  confidence      text,           -- high | medium | low
  last_updated    date default current_date,
  unique(role_title, company, location, seniority)
);

-- ── DAILY DIGEST LOG ─────────────────────────────────────────
create table public.digest_log (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles on delete cascade,
  sent_at         timestamptz default now(),
  job_count       integer,
  email_id        text           -- Resend email ID
);

-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.cv_files          enable row level security;
alter table public.shortlisted_jobs  enable row level security;
alter table public.applications      enable row level security;
alter table public.interviews        enable row level security;
alter table public.research          enable row level security;
alter table public.digest_log        enable row level security;

-- Profiles: users can only see/edit their own
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- CV files: own only
create policy "Own cv_files" on public.cv_files
  for all using (auth.uid() = user_id);

-- Shortlisted: own only
create policy "Own shortlisted" on public.shortlisted_jobs
  for all using (auth.uid() = user_id);

-- Applications: own only
create policy "Own applications" on public.applications
  for all using (auth.uid() = user_id);

-- Interviews: own only
create policy "Own interviews" on public.interviews
  for all using (auth.uid() = user_id);

-- Research: own only
create policy "Own research" on public.research
  for all using (auth.uid() = user_id);

-- Jobs: readable by all authenticated users
create policy "Jobs readable" on public.jobs
  for select using (auth.role() = 'authenticated');

-- Salary intel: readable by all authenticated users
create policy "Salary intel readable" on public.salary_intel
  for select using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════
--  FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger applications_updated_at before update on public.applications
  for each row execute procedure public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════
--  STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════

-- Run these separately in Supabase Storage settings or via API:
-- insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false);
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);

-- Storage policies (run after creating buckets):
-- create policy "CV upload" on storage.objects for insert
--   with check (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "CV read" on storage.objects for select
--   using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
