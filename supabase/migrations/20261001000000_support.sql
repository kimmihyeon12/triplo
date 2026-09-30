-- 공지·문의 서버 저장(2026-10-01). 쓰기는 모두 서버 함수로만 하고 표에는 읽기만 연다.
-- 초안 공지와 남의 문의는 RLS가 막고, 관리자 쓰기는 함수 안의 is_admin()이 막는다.
-- 설계: docs/superpowers/specs/2026-10-01-support-admin-design.md

create type notice_status as enum ('draft', 'published');
create type inquiry_kind as enum ('bug', 'idea', 'account', 'etc');
create type inquiry_status as enum ('open', 'reading', 'answered');

create table notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  status notice_status not null default 'draft',
  -- 배포 자동 공지용 칸. 2026-10-01에는 쓰지 않는다.
  generated boolean not null default false,
  release_tag text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table notice_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  notice_id uuid not null references notices (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sender_nickname text not null default '',
  kind inquiry_kind not null,
  body text not null check (char_length(body) between 1 and 1000),
  status inquiry_status not null default 'open',
  app_version text not null default '' check (char_length(app_version) <= 40),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  -- 사용자가 답변을 확인한 시각. 이보다 나중 답변이 있으면 새 답변이다.
  answer_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries (id) on delete cascade,
  -- 이번에는 관리자만 답한다. 사용자 답글을 후속으로 열 때 쓴다.
  author_role app_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index inquiries_user_idx on inquiries (user_id, created_at desc);
create index inquiry_replies_inquiry_idx on inquiry_replies (inquiry_id, created_at);

alter table notices enable row level security;
alter table notice_reads enable row level security;
alter table inquiries enable row level security;
alter table inquiry_replies enable row level security;

create policy notices_select on notices for select to authenticated
  using (status = 'published' or (select public.is_admin()));
create policy notice_reads_select_own on notice_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy inquiries_select on inquiries for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy inquiry_replies_select on inquiry_replies for select to authenticated
  using (exists (
    select 1 from public.inquiries i
    where i.id = inquiry_id and (i.user_id = (select auth.uid()) or (select public.is_admin()))
  ));

-- Supabase의 기본 권한 설정이 새 표에 권한을 줄 수 있으므로 먼저 모두 거두고 읽기만 준다.
revoke all on public.notices, public.notice_reads, public.inquiries, public.inquiry_replies from anon, authenticated;
grant select on public.notices, public.notice_reads, public.inquiries, public.inquiry_replies to authenticated;

-- 관리자 확인. 모든 관리자 함수의 첫 줄이다.
create function public.require_admin() returns void
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
end;
$$;

-- 앞뒤 공백을 지우고 길이를 본다. 비었거나 길면 P0400.
create function public.clean_text(p_text text, p_max integer) returns text
  language plpgsql immutable set search_path = '' as $$
declare v text := btrim(coalesce(p_text, ''));
begin
  if char_length(v) = 0 or char_length(v) > p_max then
    raise exception 'invalid_length' using errcode = 'P0400';
  end if;
  return v;
end;
$$;

-- 보낸 사람 닉네임은 앱이 보낸 값이 아니라 계정 정보에서 서버가 채운다.
create function public.send_inquiry(p_kind public.inquiry_kind, p_body text, p_app_version text, p_user_agent text)
  returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  insert into public.inquiries (user_id, sender_nickname, kind, body, app_version, user_agent)
  select v_user, coalesce(u.raw_user_meta_data ->> 'travel_nickname', ''), p_kind,
         public.clean_text(p_body, 1000), left(coalesce(p_app_version, ''), 40), left(coalesce(p_user_agent, ''), 300)
    from auth.users u where u.id = v_user
  returning id into v_id;
  return v_id;
end;
$$;

create function public.mark_inquiry_read(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiries set answer_read_at = now()
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

create function public.mark_notices_read() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  insert into public.notice_reads (user_id, notice_id)
  select auth.uid(), n.id from public.notices n where n.status = 'published'
  on conflict do nothing;
end;
$$;

create function public.admin_save_notice(p_id uuid, p_title text, p_body text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_admin();
  if p_id is null then
    insert into public.notices (title, body)
    values (public.clean_text(p_title, 100), public.clean_text(p_body, 5000))
    returning id into v_id;
  else
    update public.notices
       set title = public.clean_text(p_title, 100), body = public.clean_text(p_body, 5000), updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  end if;
  return v_id;
end;
$$;

create function public.admin_set_notice_published(p_id uuid, p_published boolean) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.notices
     set status = case when p_published then 'published'::public.notice_status else 'draft'::public.notice_status end,
         published_at = case when p_published then now() else null end,
         updated_at = now()
   where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

create function public.admin_delete_notice(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  delete from public.notices where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

-- 답하면 답변 완료가 된다. 사용자에게는 확인 시각보다 나중 답변이라 새 답변으로 보인다.
create function public.admin_reply_inquiry(p_id uuid, p_body text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_body text;
begin
  perform public.require_admin();
  -- 빈 답변이면 상태를 바꾸기 전에 거절한다.
  v_body := public.clean_text(p_body, 2000);
  update public.inquiries set status = 'answered', updated_at = now() where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  insert into public.inquiry_replies (inquiry_id, author_role, body)
  values (p_id, 'admin', v_body) returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_set_inquiry_status(p_id uuid, p_status public.inquiry_status) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.inquiries set status = p_status, updated_at = now() where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

revoke execute on function
  public.require_admin(), public.clean_text(text, integer),
  public.send_inquiry(public.inquiry_kind, text, text, text), public.mark_inquiry_read(uuid), public.mark_notices_read(),
  public.admin_save_notice(uuid, text, text), public.admin_set_notice_published(uuid, boolean), public.admin_delete_notice(uuid),
  public.admin_reply_inquiry(uuid, text), public.admin_set_inquiry_status(uuid, public.inquiry_status)
  from public, anon;
grant execute on function
  public.send_inquiry(public.inquiry_kind, text, text, text), public.mark_inquiry_read(uuid), public.mark_notices_read(),
  public.admin_save_notice(uuid, text, text), public.admin_set_notice_published(uuid, boolean), public.admin_delete_notice(uuid),
  public.admin_reply_inquiry(uuid, text), public.admin_set_inquiry_status(uuid, public.inquiry_status)
  to authenticated;
