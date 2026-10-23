drop policy if exists ai_usage_daily_no_client_access on public.ai_usage_daily;
create policy ai_usage_daily_no_client_access on public.ai_usage_daily
  for all to anon, authenticated using (false) with check (false);
