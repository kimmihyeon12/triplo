# 설계: 가계부를 Supabase에 저장한다

2026-09-29 작성. 브랜치 `feat/supabase-ledger`(여행 저장 브랜치 `feat/supabase-trips` 위에서 시작).

## 목적

여행별 가계부(정산할 사람·지출·분담·수령 기록·예산)를 기기 저장에서 Supabase로 옮긴다. 다음 단계인 친구 공동 편집에서 여러 사람이 동시에 지출을 더해도 서로 막히지 않도록, 가계부 전체가 아니라 **동작 한 건씩** 저장한다.

## 사용자 결정 (2026-09-29)

| 질문 | 결정 |
| --- | --- |
| 기기에 있던 가계부 | 옮기지 않고 지운다 |
| 저장 단위 | 지출 한 건씩(추가·수정·삭제, 사람 추가, 수령 기록·취소, 예산 변경이 각각 한 동작) |
| 권한 | 본인 여행의 가계부만. 친구 참여는 다음 단계에서 `owns_trip` 한 곳을 넓힌다 |

## 1. 데이터베이스

새 마이그레이션 하나. 모든 표는 `trip_id`로 여행에 딸리고, 여행을 지우면 함께 지운다. RLS는 여행 표와 같은 `owns_trip(trip_id)`이다. 표 권한은 `authenticated`에만 준다.

| 표 | 칸 | 비고 |
| --- | --- | --- |
| `trip_ledgers` | `trip_id` 기본 키, `budget integer null` | 예산. 행이 없으면 예산 미정 |
| `ledger_people` | `trip_id`, `id text`, `name`, `"order"` | 기본 키 `(trip_id, id)`. '나'(`self`)가 여행마다 있기 때문이다 |
| `expenses` | `id text` 기본 키, `trip_id`, `title`, `date`, `category`, `amount`, `paid_by`, `memo`, `link_id`, `personal`, `version`, `created_at` | `(trip_id, paid_by)`가 `ledger_people`을 가리킨다 |
| `expense_splits` | `expense_id`, `person_id`, `amount` | 기본 키 `(expense_id, person_id)`. 지출을 지우면 함께 지운다 |
| `settlement_receipts` | `id text` 기본 키, `trip_id`, `from_person`, `to_person`, `amount`, `cancelled_reason`, `created_at` | 취소해도 행은 남긴다 |

제약: 금액은 1원 이상 정수(분담액은 0 이상), 제목·이름은 공백만일 수 없다, 수령의 보낸 사람과 받은 사람은 다르다.

## 2. 저장 함수

모두 `security invoker`, `search_path = ''`, 한 호출이 한 트랜잭션이다. 로그인하지 않으면 `28000`, 본인 여행이 아니면 행이 안 보여 `P0404`(대상 없음)로 거절한다.

| 함수 | 하는 일 |
| --- | --- |
| `add_ledger_person(p_trip_id, p_person jsonb)` | 사람 추가. 같은 id가 있으면 이름만 바꾼다 |
| `save_expense(p_trip_id, p_expense jsonb, p_base_version)` | `p_base_version = 0`이면 추가, 아니면 그 지출의 버전이 같을 때만 수정하고 분담을 다시 넣는다. 다르면 `P0409`. 개인 지출이 아니면 분담 합계가 금액과 같아야 한다(`P0422`). 새 버전을 돌려준다 |
| `delete_expense(p_trip_id, p_expense_id, p_base_version)` | 버전이 같을 때만 지운다. 다르면 `P0409` |
| `add_receipt(p_trip_id, p_receipt jsonb)` | 수령 기록 추가. 금액은 양수, 두 사람은 그 여행의 사람이어야 한다 |
| `cancel_receipt(p_trip_id, p_receipt_id, p_reason)` | 취소 사유를 적는다. 이미 취소됐으면 그대로 둔다 |
| `set_budget(p_trip_id, p_budget)` | 예산을 넣거나 지운다(null) |

'나'(`self`)는 가계부를 처음 읽을 때 없으면 앱이 `add_ledger_person`으로 만든다. 지금 기기 가계부도 처음 읽을 때 '나'를 넣는 방식이다.

수령 금액이 남은 정산 금액을 넘는지는 이번에 서버에서 다시 계산하지 않는다. 화면이 막는다. 친구 공동 편집 단계에서 서버 검사로 옮긴다.

## 3. 앱

**`LedgerRepository`** (`features/expenses/data/`)
```ts
interface LedgerRepository {
  read(tripId): Promise<Ledger>;          // 없으면 '나'만 있는 빈 가계부
  apply(tripId, op: LedgerOp): Promise<void>;
}
type LedgerOp =
  | { kind: 'addPerson'; person }
  | { kind: 'saveExpense'; expense; isNew: boolean }
  | { kind: 'deleteExpense'; id }
  | { kind: 'addReceipt'; receipt }
  | { kind: 'cancelReceipt'; id; reason }
  | { kind: 'setBudget'; budget: number | null };
```
- 실행 앱은 `SupabaseLedgerRepository`, 테스트 앱과 로그인 없는 미리보기는 `LocalLedgerRepository`(지금의 기기 저장을 동작 단위로 감싼 것)를 쓴다.
- Supabase 구현은 지출마다 읽은 버전을 기억해 `save_expense`·`delete_expense`에 보낸다. 여행 저장소와 같은 방식이며 버전은 오르기만 한다.
- 오류는 여행과 같은 `TripConflictError`·`TripSaveError`로 바꿔 앱 전체 오류 토스트가 알린다.

**지출 화면** (`expenses.ts`)
- 읽기는 비동기다. 불러오는 동안은 상단 바가 로딩을 알린다.
- 저장·삭제·사람 추가·수령·취소가 각각 `apply` 한 번이다. 성공하면 화면 가계부를 서버 결과로 바꾸고, 실패하면 입력을 남기고 토스트로 알린다. 충돌이면 가계부를 다시 읽는다.
- 화면에서 먼저 하던 검사(`validateLedger`)는 그대로 두어 서버에 보내기 전에 잘못된 값을 막는다.

**챗봇** (`travel-chat-store.ts`)
- 지금은 가계부 전체를 바꾸기 전/후로 비교해 통째로 저장한다. 순수 함수 `ledgerOps(before, after): LedgerOp[]`가 둘의 차이를 동작 목록(예산 변경, 지출 추가·수정·삭제)으로 바꾸고, 차례로 `apply`한다.
- "가계부가 바뀌었어요" 검사는 서버에서 다시 읽은 가계부와 `before`를 비교한다.
- 되돌리기는 `ledgerOps(after, before)`를 보낸다.

**기기 정리**: `clearLegacyLocalTrips`와 같은 방식으로 `tc.trips.v1.ledger.*`를 한 번 지우고 `tc.trips.v1.ledgerMigrated = 'server'`를 남긴다. 여행 정리 표시(`migrated`)와 따로 둔다. 여행 정리 뒤 오늘 새로 생긴 가계부도 지워야 하기 때문이다.

## 4. 범위 밖

- 친구 참여 권한, 수령 금액의 서버 재계산(다음 단계)
- 영수증 사진 저장(지금처럼 저장하지 않는다)
- 오프라인 편집·실시간 반영

## 5. 검증

- **서버 함수:** `supabase/tests/save-trip.local.sql`처럼 로컬 PostgreSQL에서 검사한다. 지출 추가·수정·버전 충돌, 분담 합계 불일치 거절, 다른 계정 차단, 비로그인 거절, 수령 추가·취소, 예산 설정·해제.
- **앱 단위 테스트:** 행 ↔ 모델 변환, `ledgerOps` 차이 계산(추가·수정·삭제·예산), Supabase 저장소의 버전 기억, 기기 정리 한 번만.
- **e2e(테스트 앱, 기기 저장소):** 지출·정산·영수증·챗봇 가계부 명령 회귀.
- **실제 계정:** 사용자가 확인한다. 다른 기기에서 같은 가계부가 보이는지, 다른 계정에서 안 보이는지.

## 문서 갱신

`docs/architecture/DATABASE.md`(가계부 표·함수), `docs/DEVELOPMENT.md`(가계부 서버 저장), `docs/기획안-v0.1.md`(38절에 가계부 결정 추가), OpenSpec `tasks.md`(가계부 서버 저장 진행).
