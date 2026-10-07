-- 관리자 사용량·비용 화면(2026-10-07). 설계: docs/superpowers/specs/2026-10-07-admin-usage-design.md
-- Gemini 무료 키에는 사용량 조회 API가 없다. 서버 함수가 실제로 부른 호출을 한 줄씩 남긴다.
-- ai_usage는 사용자 요청 횟수(실패하면 돌려줌)라 실제 호출 수·토큰 수와 다르다.
create table public.ai_calls (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('plan', 'chat', 'receipt')),
  model text not null check (char_length(model) between 1 and 100),
  ok boolean not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0)
);
create index ai_calls_at_idx on public.ai_calls (at);

-- 서버 함수가 service_role로만 넣는다. 사용자는 표를 보지 못하고, 관리자는 집계 함수로만 본다.
alter table public.ai_calls enable row level security;
revoke all on public.ai_calls from public, anon, authenticated;
grant insert on public.ai_calls to service_role;

-- 무료 한도와 비교할 숫자를 한 번에 모은다. 단가·한도 계산은 앱이 한다.
-- 하루는 Gemini 한도가 초기화되는 태평양 시간 0시부터, 이번 달은 한국 시간 1일부터다.
create function public.admin_usage_summary() returns jsonb
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
