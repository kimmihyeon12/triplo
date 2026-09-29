-- 사용자별 AI 하루 사용 횟수(2026-09-29).
-- 앱 전체가 Gemini 무료 한도(하루 500회)를 나눠 쓰므로 사용자마다 기능별 한도를 둔다.
-- 서버 함수만 세고 읽는다. 사용자는 표와 함수에 접근하지 못한다.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('plan', 'chat', 'receipt')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- 특정 사용자의 한도를 바꿀 때 관리자가 SQL로 넣는다.
create table public.ai_quota_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('plan', 'chat', 'receipt')),
  daily_limit integer not null check (daily_limit >= 0),
  primary key (user_id, kind)
);

alter table public.ai_usage enable row level security;
alter table public.ai_quota_overrides enable row level security;
revoke all on public.ai_usage, public.ai_quota_overrides from public, anon, authenticated;

-- 오늘(한국 시간) 횟수를 하나 올리고 남은 횟수를 돌려준다.
-- 한도에 닿았으면 올리지 않고 P0429로 거절한다. 한 문장으로 올려
-- 동시에 마지막 한 번을 써도 한도를 넘지 않는다.
create function public.consume_ai_quota(p_user uuid, p_kind text, p_default_limit integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_limit integer;
  v_count integer;
begin
  select daily_limit into v_limit
    from public.ai_quota_overrides where user_id = p_user and kind = p_kind;
  v_limit := coalesce(v_limit, p_default_limit);
  insert into public.ai_usage as u (user_id, day, kind, count)
    select p_user, v_day, p_kind, 1 where v_limit > 0
  on conflict (user_id, day, kind) do update set count = u.count + 1 where u.count < v_limit
  returning u.count into v_count;
  if v_count is null then
    raise exception 'user_limit' using errcode = 'P0429', detail = v_limit::text;
  end if;
  return v_limit - v_count;
end;
$$;

-- 모델 호출이 실패했을 때 오늘 횟수를 하나 내린다. 0 아래로는 내리지 않는다.
create function public.refund_ai_quota(p_user uuid, p_kind text)
returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage set count = count - 1
   where user_id = p_user and kind = p_kind
     and day = (now() at time zone 'Asia/Seoul')::date and count > 0;
$$;

revoke execute on function public.consume_ai_quota(uuid, text, integer), public.refund_ai_quota(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer), public.refund_ai_quota(uuid, text)
  to service_role;
