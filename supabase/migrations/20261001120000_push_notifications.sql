-- 알림(웹 푸시) 2026-10-01. 설계: docs/superpowers/specs/2026-10-01-push-notifications-design.md
-- 알림은 서버 함수·트리거 안에서 outbox에 쌓고, 발송 함수(push-dispatch)가 1분마다 보낸다.
-- 저장 요청은 발송을 기다리지 않고, 발송이 실패해도 저장은 성공한다.

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  replies boolean not null default true,
  notices boolean not null default true,
  together boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  -- 받는 사람. 공지처럼 모두에게 보내는 알림은 비우고 broadcast로 표시한다.
  user_id uuid references auth.users (id) on delete cascade,
  broadcast boolean not null default false,
  kind text not null check (kind in ('reply', 'notice', 'join', 'trip', 'ledger')),
  title text not null,
  body text not null,
  url text not null,
  -- 묶기 열쇠. 같은 열쇠는 10분 안에 한 번만 쌓는다(일정을 고칠 때마다 저장이 여러 번 일어난다).
  group_key text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (broadcast or user_id is not null)
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where sent_at is null;
create index notification_outbox_group_idx on public.notification_outbox (user_id, group_key, created_at);

alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_outbox enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy notification_settings_own on public.notification_settings for select to authenticated using (user_id = auth.uid());
-- outbox에는 정책을 두지 않는다. 앱 사용자는 읽지도 쓰지도 못한다. 발송 함수(service role)만 쓴다.

revoke all on public.push_subscriptions, public.notification_settings, public.notification_outbox from anon, authenticated;
grant select on public.push_subscriptions, public.notification_settings to authenticated;

-- 이 기기의 구독을 남긴다. 같은 기기를 다른 계정으로 쓰면 그 계정으로 옮긴다.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(length(p_p256dh), 0) not between 1 and 200 or coalesce(length(p_auth), 0) not between 1 and 100 then
    raise exception 'invalid_subscription' using errcode = 'P0400';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
    values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
          user_agent = excluded.user_agent, created_at = now();
end;
$$;

create function public.delete_push_subscription(p_endpoint text) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

create function public.save_notification_settings(p_replies boolean, p_notices boolean, p_together boolean) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  insert into public.notification_settings (user_id, replies, notices, together)
    values (auth.uid(), coalesce(p_replies, true), coalesce(p_notices, true), coalesce(p_together, true))
    on conflict (user_id) do update
      set replies = excluded.replies, notices = excluded.notices, together = excluded.together, updated_at = now();
end;
$$;

-- 알림 하나를 쌓는다. 묶기 열쇠가 있으면 10분 안의 같은 열쇠는 건너뛴다. 내부용.
create function public.queue_notification(p_user uuid, p_kind text, p_title text, p_body text, p_url text, p_group text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if p_group <> '' and exists (
    select 1 from public.notification_outbox
     where user_id = p_user and group_key = p_group and created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  insert into public.notification_outbox (user_id, kind, title, body, url, group_key)
    values (p_user, p_kind, left(p_title, 60), left(p_body, 120), p_url, p_group);
end;
$$;

-- 함께하는 사람의 닉네임. 여행 멤버 표에 합류할 때의 닉네임이 있다.
create function public.member_nickname(p_trip text, p_user uuid) returns text
  language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(nickname, ''), '함께하는 사람') from public.trip_members where trip_id = p_trip and user_id = p_user
$$;

-- 1. 문의에 관리자가 답하면 문의한 사람에게
create function public.notify_inquiry_reply() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_body text;
begin
  if new.author_role <> 'admin' then return new; end if;
  select user_id, split_part(body, E'\n', 1) into v_owner, v_body from public.inquiries where id = new.inquiry_id;
  if v_owner is not null then
    perform public.queue_notification(v_owner, 'reply', '문의에 답변이 왔어요', left(v_body, 30), '/account/inquiries', '');
  end if;
  return new;
end;
$$;
create trigger inquiry_replies_notify after insert on public.inquiry_replies
  for each row execute function public.notify_inquiry_reply();

-- 2. 공지를 발행하면 공지 알림을 켠 모두에게(받는 사람은 발송 함수가 정한다)
create function public.notify_notice_published() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notification_outbox (broadcast, kind, title, body, url)
      values (true, 'notice', '새 공지', left(new.title, 120), '/account/notices');
  end if;
  return new;
end;
$$;
create trigger notices_notify after update of status on public.notices
  for each row execute function public.notify_notice_published();

-- 3. 누가 여행에 참여하면 나머지 멤버에게
create function public.notify_member_joined() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_member record;
begin
  select title into v_title from public.trips where id = new.trip_id;
  for v_member in select user_id from public.trip_members where trip_id = new.trip_id and user_id <> new.user_id loop
    perform public.queue_notification(
      v_member.user_id, 'join', '함께하는 사람이 늘었어요',
      format('%s님이 「%s」에 참여했어요', coalesce(nullif(new.nickname, ''), '함께하는 사람'), v_title),
      '/trips/' || new.trip_id, '');
  end loop;
  return new;
end;
$$;
create trigger trip_members_notify after insert on public.trip_members
  for each row execute function public.notify_member_joined();

-- 4. 일정을 고치면 그 여행의 다른 멤버에게(고친 사람 제외, 10분에 한 번)
create function public.notify_trip_edited() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_member record;
begin
  if v_actor is null then return new; end if;
  for v_member in select user_id from public.trip_members where trip_id = new.id and user_id <> v_actor loop
    perform public.queue_notification(
      v_member.user_id, 'trip', '일정이 바뀌었어요',
      format('%s님이 「%s」 일정을 고쳤어요', public.member_nickname(new.id, v_actor), new.title),
      '/trips/' || new.id, format('trip:%s:%s', new.id, v_actor));
  end loop;
  return new;
end;
$$;
create trigger trips_notify after update on public.trips
  for each row execute function public.notify_trip_edited();

-- 5. 지출을 남기거나 고치면 그 여행의 다른 멤버에게(고친 사람 제외, 10분에 한 번)
create function public.notify_ledger_edited() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_trip text := coalesce(new.trip_id, old.trip_id);
  v_title text;
  v_member record;
begin
  if v_actor is null then return null; end if;
  -- 개인 지출은 다른 멤버에게 보이지 않는 기록이라 알리지도 않는다.
  if coalesce(new.personal, old.personal) then return null; end if;
  select title into v_title from public.trips where id = v_trip;
  -- 여행을 지우면 지출도 함께 지워진다. 그때는 알리지 않는다.
  if v_title is null then return null; end if;
  for v_member in select user_id from public.trip_members where trip_id = v_trip and user_id <> v_actor loop
    perform public.queue_notification(
      v_member.user_id, 'ledger', '가계부가 바뀌었어요',
      format('%s님이 「%s」 가계부를 고쳤어요', public.member_nickname(v_trip, v_actor), v_title),
      '/trips/' || v_trip || '/expenses', format('ledger:%s:%s', v_trip, v_actor));
  end loop;
  return null;
end;
$$;
create trigger expenses_notify after insert or update or delete on public.expenses
  for each row execute function public.notify_ledger_edited();

revoke execute on function
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.save_notification_settings(boolean, boolean, boolean),
  public.queue_notification(uuid, text, text, text, text, text), public.member_nickname(text, uuid),
  public.notify_inquiry_reply(), public.notify_notice_published(), public.notify_member_joined(),
  public.notify_trip_edited(), public.notify_ledger_edited()
  from public, anon, authenticated;
grant execute on function
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.save_notification_settings(boolean, boolean, boolean)
  to authenticated;
