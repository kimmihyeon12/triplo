-- 알림 내역(2026-10-06). 내 정보 > 소식 > 알림 내역에서 지난 알림을 본다.
-- 발송 대기열(notification_outbox)은 앱 사용자가 읽지 못하고 보낸 뒤 7일이면 지워진다. 내역은 따로 남긴다.
-- 푸시를 켜지 않은 사람도 남긴다(사용자 결정). 알림 설정에서 끈 종류만 뺀다. 30일이 지나면 지운다(cron 파일).

create table public.notification_inbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reply', 'notice', 'join', 'trip', 'ledger')),
  title text not null,
  body text not null,
  url text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notification_inbox_user_idx on public.notification_inbox (user_id, created_at desc);
create index notification_inbox_unread_idx on public.notification_inbox (user_id) where read_at is null;

alter table public.notification_inbox enable row level security;
create policy notification_inbox_own on public.notification_inbox for select to authenticated using (user_id = auth.uid());
revoke all on public.notification_inbox from anon, authenticated;
-- 앱은 자기 내역을 읽기만 한다. 읽음 표시는 아래 함수로만 한다.
grant select on public.notification_inbox to authenticated;

-- 그 사람이 이 종류의 알림을 받는지. 설정을 저장한 적 없으면 모두 받는다(발송 함수의 분류와 같다).
create function public.inbox_wants(p_user uuid, p_kind text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case p_kind when 'reply' then replies when 'notice' then notices else together end
      from public.notification_settings where user_id = p_user
  ), true)
$$;

-- 알림 하나를 쌓는다(20261001120000을 바꾼다). 묶기 열쇠가 같으면 10분 안에 한 번만 쌓고,
-- 대기열에 쌓을 때 내역에도 남긴다. 그래서 일정을 여러 번 고쳐도 내역이 넘치지 않는다.
create or replace function public.queue_notification(p_user uuid, p_kind text, p_title text, p_body text, p_url text, p_group text)
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
  if public.inbox_wants(p_user, p_kind) then
    insert into public.notification_inbox (user_id, kind, title, body, url)
      values (p_user, p_kind, left(p_title, 60), left(p_body, 120), p_url);
  end if;
end;
$$;

-- 공지 발행(20261001120000을 바꾼다). 푸시는 한 줄로 보내고, 내역은 공지 알림을 켠 사람마다 남긴다.
create or replace function public.notify_notice_published() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notification_outbox (broadcast, kind, title, body, url)
      values (true, 'notice', '새 공지', left(new.title, 120), '/account/notices');
    insert into public.notification_inbox (user_id, kind, title, body, url)
      select u.id, 'notice', '새 공지', left(new.title, 120), '/account/notices'
        from auth.users u
       where public.inbox_wants(u.id, 'notice');
  end if;
  return new;
end;
$$;

-- 내 알림을 모두 읽음으로 한다. 알림 내역을 열면 부른다.
create function public.mark_notifications_read() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  update public.notification_inbox set read_at = now() where user_id = auth.uid() and read_at is null;
end;
$$;

revoke execute on function public.inbox_wants(uuid, text), public.mark_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
-- queue_notification·notify_notice_published는 바꾼 뒤에도 앱 사용자가 직접 부르지 못한다.
revoke execute on function public.queue_notification(uuid, text, text, text, text, text), public.notify_notice_published()
  from public, anon, authenticated;
