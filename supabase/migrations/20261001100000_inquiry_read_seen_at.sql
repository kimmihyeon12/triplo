-- 답변 읽음 시각을 '누른 시각'이 아니라 '화면에 보인 마지막 답변 시각'으로 남긴다(2026-10-01).
-- 사용자가 목록을 연 뒤 관리자가 답을 더 달면, 누른 시각으로는 본 적 없는 답변까지 읽음이 된다.
-- p_seen_at이 없으면(배포된 옛 앱) 지금 시각을 쓴다. 미래 시각은 지금으로 자르고, 읽음은 뒤로 돌리지 않는다.
drop function public.mark_inquiry_read(uuid);

create function public.mark_inquiry_read(p_id uuid, p_seen_at timestamptz default null) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiries
     set answer_read_at = greatest(
       coalesce(answer_read_at, '-infinity'::timestamptz),
       least(coalesce(p_seen_at, now()), now())
     )
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end;
$$;

revoke execute on function public.mark_inquiry_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_inquiry_read(uuid, timestamptz) to authenticated;
