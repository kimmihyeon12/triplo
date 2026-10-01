-- 배포할 때 공지 초안을 만든다(2026-10-01). 관리자는 초안을 다듬어 직접 발행한다.
-- 배포 담당이 Supabase CLI(데이터베이스 소유자)로 부른다. 앱 사용자·관리자 화면은 부를 수 없다.
-- 같은 배포 태그의 자동 초안은 한 번만 생긴다. 다시 불러도 새로 만들지 않고 null을 돌려준다.
alter table public.notices
  add constraint notices_generated_has_tag check (not generated or release_tag <> '');

create unique index notices_generated_release_tag on public.notices (release_tag) where generated;

create function public.release_notice_draft(p_tag text, p_title text, p_body text) returns uuid
  language plpgsql set search_path = '' as $$
declare
  v_tag text := btrim(coalesce(p_tag, ''));
  v_id uuid;
begin
  if v_tag = '' then raise exception 'invalid_length' using errcode = 'P0400'; end if;
  insert into public.notices (title, body, status, generated, release_tag)
    values (public.clean_text(p_title, 100), public.clean_text(p_body, 5000), 'draft', true, v_tag)
    on conflict (release_tag) where generated do nothing
    returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.release_notice_draft(text, text, text) from public, anon, authenticated;
