-- AI Spanish Coach bot extension schema
-- Run this after supabase/schema.sql.

create table if not exists public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  spanish text not null unique,
  meaning_zh text not null,
  example_es text not null,
  example_zh text not null,
  level text not null default 'A1',
  created_at timestamptz not null default now()
);

create table if not exists public.user_vocabulary_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  telegram_user_id text,
  vocabulary_item_id uuid references public.vocabulary_items(id) on delete cascade,
  status text not null default 'new',
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  next_review_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, telegram_user_id, vocabulary_item_id)
);

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  telegram_user_id text,
  quiz_type text not null,
  mode text,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_session_id uuid references public.quiz_sessions(id) on delete cascade,
  prompt text not null,
  selected_answer text,
  correct_answer text not null,
  correct boolean not null default false,
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists public.grammar_items (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'A1',
  topic text not null,
  prompt text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.translation_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  telegram_user_id text,
  direction text not null,
  source_text text not null,
  user_answer text,
  corrected_answer text,
  score integer,
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.speaking_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  telegram_user_id text,
  target_sentence_es text not null,
  target_sentence_zh text,
  transcript text,
  feedback text,
  score integer,
  created_at timestamptz not null default now()
);

create table if not exists public.tts_audio_cache (
  id uuid primary key default gen_random_uuid(),
  text_hash text not null unique,
  text text not null,
  voice text,
  audio_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_learners (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  display_name text not null,
  learned_vocabulary_count integer not null default 0,
  wrong_vocabulary_count integer not null default 0,
  check_in_days integer not null default 0,
  last_check_in_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vocabulary_items enable row level security;
alter table public.user_vocabulary_progress enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.grammar_items enable row level security;
alter table public.translation_exercises enable row level security;
alter table public.speaking_exercises enable row level security;
alter table public.tts_audio_cache enable row level security;
alter table public.telegram_learners enable row level security;

drop policy if exists "vocabulary_items_read_all" on public.vocabulary_items;
create policy "vocabulary_items_read_all" on public.vocabulary_items for select using (true);
drop policy if exists "grammar_items_read_all" on public.grammar_items;
create policy "grammar_items_read_all" on public.grammar_items for select using (true);
drop policy if exists "tts_audio_cache_read_all" on public.tts_audio_cache;
create policy "tts_audio_cache_read_all" on public.tts_audio_cache for select using (true);
drop policy if exists "telegram_learners_read_all" on public.telegram_learners;
create policy "telegram_learners_read_all" on public.telegram_learners for select using (true);

drop policy if exists "user_vocabulary_progress_own" on public.user_vocabulary_progress;
create policy "user_vocabulary_progress_own" on public.user_vocabulary_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "quiz_sessions_own" on public.quiz_sessions;
create policy "quiz_sessions_own" on public.quiz_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "quiz_answers_by_session_owner" on public.quiz_answers;
create policy "quiz_answers_by_session_owner" on public.quiz_answers for all using (
  exists (select 1 from public.quiz_sessions s where s.id = quiz_session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.quiz_sessions s where s.id = quiz_session_id and s.user_id = auth.uid())
);
drop policy if exists "translation_exercises_own" on public.translation_exercises;
create policy "translation_exercises_own" on public.translation_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "speaking_exercises_own" on public.speaking_exercises;
create policy "speaking_exercises_own" on public.speaking_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.vocabulary_items (spanish, meaning_zh, example_es, example_zh, level) values
('viaje','旅行','Mi viaje a España fue increíble.','我的西班牙旅行非常棒。','A1'),
('calle','街道','La calle es muy bonita.','这条街很漂亮。','A1'),
('agua','水','Quiero un vaso de agua.','我想要一杯水。','A1'),
('café','咖啡','Quisiera un café, por favor.','请给我一杯咖啡。','A1'),
('azúcar','糖','Prefiero café sin azúcar.','我更喜欢不加糖的咖啡。','A1')
on conflict (spanish) do nothing;
