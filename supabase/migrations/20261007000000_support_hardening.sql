-- 공지·문의 함수 보강(2026-10-07).
-- 1) 내부 도우미 require_admin·clean_text는 다른 함수 안에서만 쓴다. Supabase는 새 함수에
--    authenticated 실행 권한을 기본으로 주므로 명시적으로 회수한다. 부르는 함수는 security definer라
--    소유자 권한으로 실행되어 영향이 없다.
-- 2) send_inquiry에 사람별 속도 제한을 둔다. 최근 1시간에 5건까지. 넘으면 P0429.
--    같은 사람의 동시 요청은 트랜잭션 잠금으로 줄을 세워 한도를 넘지 않게 한다.

revoke execute on function public.require_admin(), public.clean_text(text, integer) from authenticated;

create index if not exists inquiries_user_created_idx on public.inquiries (user_id, created_at desc);

create or replace function public.send_inquiry(p_kind public.inquiry_kind, p_body text, p_app_version text, p_user_agent text)
  returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('send_inquiry:' || v_user::text, 0));
  if (select count(*) from public.inquiries
       where user_id = v_user and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_inquiries' using errcode = 'P0429';
  end if;
  insert into public.inquiries (user_id, sender_nickname, kind, body, app_version, user_agent)
  select v_user, coalesce(u.raw_user_meta_data ->> 'travel_nickname', ''), p_kind,
         public.clean_text(p_body, 1000), left(coalesce(p_app_version, ''), 40), left(coalesce(p_user_agent, ''), 300)
    from auth.users u where u.id = v_user
  returning id into v_id;
  return v_id;
end;
$$;
