-- 사용량 화면에 최근 24시간 호출 수를 더한다(2026-10-07 사용자 지적).
-- 하루 기준(태평양 시간 0시 = 한국 오후 4시)이 바뀌면 오늘 호출이 0회로 돌아가 사용량이 사라진 것처럼 보였다.
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
