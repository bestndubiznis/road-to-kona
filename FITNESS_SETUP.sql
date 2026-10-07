-- Fitness log: all detailed rows are private; the Edge Function projects public metrics.
create table if not exists public.fitness_workouts (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.fitness_settings (
  key text primary key,
  value jsonb not null
);
create table if not exists public.fitness_checkins (
  date date primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.fitness_followups (
  date date primary key,
  asked_at timestamptz not null default now(),
  workout_ids jsonb not null default '[]'::jsonb,
  answered_at timestamptz
);
alter table public.fitness_workouts enable row level security;
alter table public.fitness_settings enable row level security;
alter table public.fitness_checkins enable row level security;
alter table public.fitness_followups enable row level security;
-- Browser roles have no direct access. Authorization happens in fitness-api.
revoke all on public.fitness_workouts, public.fitness_settings, public.fitness_checkins, public.fitness_followups from anon, authenticated;
grant all on public.fitness_workouts, public.fitness_settings, public.fitness_checkins, public.fitness_followups to service_role;
create index if not exists fitness_workouts_date on public.fitness_workouts ((data->>'date'));
-- Owner email is configured privately, never committed to the public repository.
create table if not exists public.fitness_push_subscriptions (
  endpoint_hash text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.fitness_push_deliveries (
  date date not null,
  endpoint_hash text not null,
  status text not null default 'sending',
  attempts integer not null default 1,
  error text,
  updated_at timestamptz not null default now(),
  primary key (date, endpoint_hash)
);
alter table public.fitness_push_subscriptions enable row level security;
alter table public.fitness_push_deliveries enable row level security;
revoke all on public.fitness_push_subscriptions, public.fitness_push_deliveries from anon, authenticated;
grant all on public.fitness_push_subscriptions, public.fitness_push_deliveries to service_role;
