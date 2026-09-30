-- 정산 수령 기록에 여행별 직렬화와 최신 잔액 검사를 더한다(2026-09-30 감리 P1-04).
--
-- 예전 add_receipt는 권한만 확인하고 INSERT했다. 같은 10,000원 미수금을 두 브라우저가
-- 각각 수령 처리하면 서로 다른 id로 20,000원이 기록되고, 앱은 이를 거꾸로 된 빚으로 계산했다.
--
-- - 여행 가계부 단위로 트랜잭션 잠금을 잡아 같은 여행의 수령 기록을 하나씩 처리한다.
-- - 앱의 balances()와 같은 식으로 잔액을 계산한다: 공동 지출의 결제액 − 분담액,
--   취소되지 않은 수령의 보낸 금액 + , 받은 금액 −. 보내는 사람의 남은 빚과 받는 사람의
--   남은 받을 돈을 넘는 수령은 충돌(P0409)로 거절한다. 앱은 충돌이면 가계부를 다시 읽는다.
-- - 같은 id로 다시 온 요청(재시도·두 번 누름)은 새로 기록하지 않는다.
-- 테이블 구조는 바꾸지 않는다. 함수 본문만 바꾸므로 되돌릴 때는 이전 본문으로 다시 만든다.

create or replace function public.ledger_balance(p_trip_id text, p_person text) returns bigint
language sql stable security invoker set search_path = '' as $$
  select
      coalesce((select sum(e.amount) from public.expenses e
                 where e.trip_id = p_trip_id and e.paid_by = p_person and not e.personal), 0)
    - coalesce((select sum(s.amount) from public.expense_splits s
                  join public.expenses e on e.id = s.expense_id
                 where s.trip_id = p_trip_id and s.person_id = p_person and not e.personal), 0)
    + coalesce((select sum(r.amount) from public.settlement_receipts r
                 where r.trip_id = p_trip_id and r.from_person = p_person and r.cancelled_reason is null), 0)
    - coalesce((select sum(r.amount) from public.settlement_receipts r
                 where r.trip_id = p_trip_id and r.to_person = p_person and r.cancelled_reason is null), 0);
$$;

revoke execute on function public.ledger_balance(text, text) from public, anon, authenticated;

create or replace function public.add_receipt(p_trip_id text, p_receipt jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := p_receipt->>'id';
  v_from text := p_receipt->>'from';
  v_to text := p_receipt->>'to';
  v_amount integer := (p_receipt->>'amount')::integer;
begin
  perform public.ledger_guard(p_trip_id);
  -- 같은 여행의 수령 기록은 트랜잭션이 끝날 때까지 하나씩 처리한다.
  perform pg_advisory_xact_lock(hashtext('ledger_receipt:' || p_trip_id));

  if exists (select from public.settlement_receipts where id = v_id and trip_id = p_trip_id) then
    return;
  end if;

  if v_amount is null or v_amount <= 0
     or public.ledger_balance(p_trip_id, v_from) > -v_amount
     or public.ledger_balance(p_trip_id, v_to) < v_amount then
    raise exception 'receipt_exceeds_balance' using errcode = 'P0409';
  end if;

  insert into public.settlement_receipts (id, trip_id, from_person, to_person, amount)
  values (v_id, p_trip_id, v_from, v_to, v_amount);
end;
$$;
