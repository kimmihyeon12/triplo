-- 분담 → 지출 외래 키가 둘(expense_id 하나, (expense_id, trip_id) 둘)이 되면서
-- PostgREST가 지출과 분담을 함께 읽을 때 관계를 고르지 못해 PGRST201로 실패했다
-- (2026-09-29 v0.9.0 배포 직후 가계부를 불러오지 못함).
-- (expense_id, trip_id) 외래 키가 같은 참조와 cascade 삭제를 맡으므로 옛 키를 지운다.
alter table public.expense_splits drop constraint expense_splits_expense_id_fkey;
