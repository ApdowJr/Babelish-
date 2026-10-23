-- Babelish Android Supabase foundation. Applied to the dedicated development project.
-- Revoke public execution of the project setup helper flagged by the security advisor.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create table if not exists public.chapters (
  id text primary key,
  language_id text not null,
  cefr text not null default 'A1',
  order_index integer not null default 0,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved')),
  version integer not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists public.lessons (
  id text primary key,
  chapter_id text not null references public.chapters(id) on delete cascade,
  order_index integer not null default 0,
  title text not null,
  goal text not null default ''
);
create table if not exists public.exercises (
  id text primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  order_index integer not null default 0,
  type text not null check (type in ('choose', 'type', 'listen', 'speak')),
  prompt text not null default '',
  question text not null,
  options jsonb,
  answer jsonb not null,
  hint text,
  note text,
  vocab jsonb
);
create index if not exists chapters_lang_idx on public.chapters (language_id, order_index);
create index if not exists lessons_chapter_idx on public.lessons (chapter_id, order_index);
create index if not exists exercises_lesson_idx on public.exercises (lesson_id, order_index);

create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  score integer not null default 0 check (score between 0 and 100),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create table if not exists public.user_vocab (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  language_id text not null,
  target text not null,
  translation text not null default '',
  box integer not null default 1 check (box between 1 and 5),
  due_at timestamptz not null default now() + interval '1 day',
  last_reviewed_at timestamptz,
  primary key (user_id, item_key)
);
create index if not exists user_vocab_due_idx on public.user_vocab (user_id, due_at);

alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_vocab enable row level security;

drop policy if exists chapters_read_approved on public.chapters;
create policy chapters_read_approved on public.chapters for select to authenticated using (status = 'approved');
drop policy if exists lessons_read_approved on public.lessons;
create policy lessons_read_approved on public.lessons for select to authenticated
using (exists (select 1 from public.chapters c where c.id = lessons.chapter_id and c.status = 'approved'));
drop policy if exists exercises_read_approved on public.exercises;
create policy exercises_read_approved on public.exercises for select to authenticated
using (exists (
  select 1 from public.lessons l join public.chapters c on c.id = l.chapter_id
  where l.id = exercises.lesson_id and c.status = 'approved'
));
drop policy if exists progress_own on public.user_progress;
create policy progress_own on public.user_progress for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists vocab_own on public.user_vocab;
create policy vocab_own on public.user_vocab for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on public.chapters, public.lessons, public.exercises to authenticated;
grant select, insert, update, delete on public.user_progress, public.user_vocab to authenticated;
revoke all on public.chapters, public.lessons, public.exercises, public.user_progress, public.user_vocab from anon;
