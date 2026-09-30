-- 정산할 사람을 지운다(2026-09-29 사용자 요청).
-- '나'(self)는 기록하는 본인이라 남긴다. 지출·분담·수령이 가리키는 사람은
-- 외래 키가 막으므로(23503) 기록을 먼저 고쳐야 지울 수 있다.
create function remove_ledger_person(p_trip_id text, p_person_id text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  if p_person_id = 'self' then
    raise exception 'self_required' using errcode = 'P0422';
  end if;
  delete from public.ledger_people where trip_id = p_trip_id and id = p_person_id;
end;
$$;

revoke execute on function remove_ledger_person(text, text) from public, anon;
grant execute on function remove_ledger_person(text, text) to authenticated;
