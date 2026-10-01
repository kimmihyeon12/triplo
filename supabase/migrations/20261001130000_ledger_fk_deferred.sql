-- 지출이 있는 여행 삭제·회원탈퇴가 실패하던 문제(2026-10-01 발견).
-- 여행을 지우면 가계부 사람(ledger_people)과 지출·분담·정산이 함께 지워지는데, 사람 행이 먼저
-- 지워지는 순간 아직 남은 분담·지출이 그 사람을 가리켜 외래 키 검사에 걸렸다.
-- 사람을 가리키는 외래 키를 트랜잭션 끝에 검사하게 바꾼다. 연쇄 삭제가 모두 끝난 뒤에 보므로
-- 통과하고, 지출에 쓰인 사람을 따로 지우면 지금처럼 막힌다.
alter table public.expenses
  drop constraint expenses_trip_id_paid_by_fkey,
  add constraint expenses_trip_id_paid_by_fkey
    foreign key (trip_id, paid_by) references public.ledger_people (trip_id, id) deferrable initially deferred;

alter table public.expense_splits
  drop constraint expense_splits_trip_id_person_id_fkey,
  add constraint expense_splits_trip_id_person_id_fkey
    foreign key (trip_id, person_id) references public.ledger_people (trip_id, id) deferrable initially deferred;

alter table public.settlement_receipts
  drop constraint settlement_receipts_trip_id_from_person_fkey,
  add constraint settlement_receipts_trip_id_from_person_fkey
    foreign key (trip_id, from_person) references public.ledger_people (trip_id, id) deferrable initially deferred,
  drop constraint settlement_receipts_trip_id_to_person_fkey,
  add constraint settlement_receipts_trip_id_to_person_fkey
    foreign key (trip_id, to_person) references public.ledger_people (trip_id, id) deferrable initially deferred;
