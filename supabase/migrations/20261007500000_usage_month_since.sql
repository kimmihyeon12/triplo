-- 예상 월 비용을 이번 달 첫 기록부터 센 날수로 계산하도록 이번 달 첫 기록 시각을 더한다(2026-10-07).
-- 기록을 10월 7일 오후에 시작했는데 1일부터 7일로 나눠 1명당 비용이 7분의 1로 낮게 나왔다.
create or replace function public.admin_usage_summary() returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_day timestamptz := date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  v_month timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object(
    'measuredAt', now(),
    'gemini', pg_catalog.jsonb_build_object(
      'dayStart', v_day,
      'dayRequests', (select count(*) from public.ai_calls where at >= v_day),
      'dayFailed', (select count(*) from public.ai_calls where at >= v_day and not ok),
      'last24hRequests', (select count(*) from public.ai_calls where at >= now() - interval '24 hours'),
      'monthSince', (select min(at) from public.ai_calls where at >= v_month),
      'month', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'kind', kind, 'model', model, 'requests', requests,
          'inputTokens', input_tokens, 'outputTokens', output_tokens) order by kind, model)
        from (
          select kind, model, count(*) as requests,
                 sum(input_tokens)::bigint as input_tokens, sum(output_tokens)::bigint as output_tokens
            from public.ai_calls where at >= v_month group by kind, model
        ) m), '[]'::jsonb)
    ),
    'supabase', pg_catalog.jsonb_build_object(
      'dbBytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
      'storageBytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects),
      'activeUsers30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days')
    )
  );
end;
$$;

revoke execute on function public.admin_usage_summary() from public, anon;
grant execute on function public.admin_usage_summary() to authenticated;
