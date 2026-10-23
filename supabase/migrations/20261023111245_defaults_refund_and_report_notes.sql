-- Add auth.uid() defaults for owner-scoped tables, resolution metadata on
-- content_reports for the review dashboard, and quota refund RPC on upstream failure.

alter table public.user_progress
  alter column user_id set default auth.uid();

alter table public.user_vocab
  alter column user_id set default auth.uid();

alter table public.content_reports
  alter column user_id set default auth.uid(),
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz;

create or replace function public.refund_ai_usage(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare today_utc date := (timezone('utc', now()))::date;
begin
  if p_user_id is null or p_kind not in ('chat', 'stt') then
    return;
  end if;
  if p_kind = 'chat' then
    update public.ai_usage_daily
       set chat_count = greatest(0, chat_count - 1)
     where user_id = p_user_id and usage_date = today_utc;
  else
    update public.ai_usage_daily
       set stt_count = greatest(0, stt_count - 1)
     where user_id = p_user_id and usage_date = today_utc;
  end if;
end;
$$;

revoke all on function public.refund_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_usage(uuid, text) to service_role;
