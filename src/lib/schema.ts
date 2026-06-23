export function getSchemaSql() {
  return `
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  spanish_level text check (spanish_level in ('A0','A1','A2','B1','B2','C1')),
  learning_goal text,
  target_days integer check (target_days between 1 and 180),
  current_streak integer not null default 0,
  last_completed_on date,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_level text not null,
  goal text not null,
  target_days integer not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_plan_id uuid references public.study_plans(id) on delete cascade,
  day_number integer not null,
  task_type text not null check (task_type in ('vocabulary','grammar','speaking')),
  title text not null,
  description text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_text text not null,
  corrected_text text not null,
  explanation text,
  category text not null default 'general',
  archived_to_telegram boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  archive_type text not null,
  title text not null,
  body text not null,
  telegram_chat_id text,
  telegram_message_id text,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_learners (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  display_name text not null,
  learned_vocabulary_count integer not null default 0,
  wrong_vocabulary_count integer not null default 0,
  check_in_days integer not null default 0,
  interface_language text not null default 'zh' check (interface_language in ('zh','en')),
  last_check_in_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_learners
add column if not exists interface_language text not null default 'zh' check (interface_language in ('zh','en'));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.study_plans enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.mistakes enable row level security;
alter table public.telegram_archives enable row level security;
alter table public.telegram_learners enable row level security;

create policy if not exists "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy if not exists "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy if not exists "study_plans_all_own" on public.study_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "daily_tasks_all_own" on public.daily_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "mistakes_all_own" on public.mistakes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "telegram_archives_all_own" on public.telegram_archives for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
`
}
