-- Server-side AI quota ledger for Babelish Supabase Edge Functions.
create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now())::date),
  chat_count integer not null default 0 check (chat_count >= 0),
  stt_count integer not null default 0 check (stt_count >= 0),
  primary key (user_id, usage_date)
);
alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from anon, authenticated;

create or replace function public.claim_ai_usage(
  p_user_id uuid,
  p_kind text,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
  today_utc date := (timezone('utc', now()))::date;
begin
  if p_user_id is null or p_kind not in ('chat', 'stt') or p_limit < 1 or p_limit > 1000 then
    return false;
  end if;

  if p_kind = 'chat' then
    insert into public.ai_usage_daily (user_id, usage_date, chat_count)
    values (p_user_id, today_utc, 1)
    on conflict (user_id, usage_date) do update
      set chat_count = public.ai_usage_daily.chat_count + 1
      where public.ai_usage_daily.chat_count < p_limit
    returning true into claimed;
  else
    insert into public.ai_usage_daily (user_id, usage_date, stt_count)
    values (p_user_id, today_utc, 1)
    on conflict (user_id, usage_date) do update
      set stt_count = public.ai_usage_daily.stt_count + 1
      where public.ai_usage_daily.stt_count < p_limit
    returning true into claimed;
  end if;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_ai_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_usage(uuid, text, integer) to service_role;

-- Explicit deny policy documents that only the service-role RPC may access this ledger.
drop policy if exists ai_usage_daily_no_client_access on public.ai_usage_daily;
create policy ai_usage_daily_no_client_access on public.ai_usage_daily
  for all to anon, authenticated using (false) with check (false);
