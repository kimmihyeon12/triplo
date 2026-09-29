# 데이터베이스 구조

여행과 가계부를 계정별로 저장하는 표 구조다. 원본 마이그레이션은 `supabase/migrations/`에 있고, 앱 모델은 `app/src/app/features/trips/model/trip.ts`다. 이 문서는 두 곳의 대응 관계와 설계 결정을 기록한다.

2026-09-17 작성, 2026-09-29 원격 적용·저장 함수 추가. 적용 여부는 아래 '적용 현황'을 본다.

## 전체 관계

```text
auth.users
    │ 1
    │ owner_id                계정을 지우면 여행도 지운다
    ▼ N
  trips ────────────────────────────────────┐
    │ 1                  1                  │ 1
    │                    │                  │
    ▼ N                  ▼ N                ▼ N
trip_regions       trip_stops      accommodation_stays
    △ 1                 │ region_id          │ region_id
    └────────────────────┴────────────────────┘
         지역을 지우면 연결만 끊고 항목은 남긴다
```

여행이 중심이다. 지역·장소·숙소는 모두 여행에 딸리며 여행을 지우면 함께 사라진다.

## 표별 구조

### trips — 여행

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text | 기본 키. 앱이 만든 값을 그대로 쓴다. AI 일정 담기가 UUID가 아닌 고정 id를 써서 text다 |
| owner_id | uuid | `auth.users`를 참조. 계정 삭제 시 함께 삭제 |
| title | text | 여행 이름 |
| start_date | date | null이면 날짜 미정 |
| end_date | date | null이면 날짜 미정 |
| status | trip_status | 현재 `draft`뿐이다 |
| schema_version | smallint | 모델 변경 시 이전 데이터를 구분한다 |
| created_at | timestamptz | |
| updated_at | timestamptz | 목록 정렬 기준 |
| version | integer | 저장이 성공할 때마다 1 오른다. 저장 충돌 확인용(2026-09-29) |

`(owner_id, updated_at desc)` 색인을 둔다. 여행 목록이 이 순서로 읽기 때문이다.

### trip_regions — 여행 안의 지역

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text | 기본 키 |
| trip_id | text | 여행 삭제 시 함께 삭제 |
| name | text | 지역 이름 |
| "order" | integer | 표시 순서. `order`가 예약어라 따옴표를 쓴다 |
| region_code | text | 표준 지역 코드. 통계 집계 키. 예전 여행에는 없을 수 있다(2026-09-29) |

### trip_stops — 일정 항목

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text | 기본 키 |
| trip_id | text | 여행 삭제 시 함께 삭제 |
| region_id | text | 지역 삭제 시 null이 된다. 항목은 남는다 |
| kind | stop_kind | `place`·`meal`·`break`·`buffer` |
| name | text | |
| address | text | 기본값은 빈 문자열 |
| date | date | **null이면 아직 어느 날짜에도 배치하지 않은 상태** |
| "order" | integer | 그 날짜 안에서의 순서 |
| stay_minutes | integer | 체류 계획(분). null은 미정 |
| memo | text | |
| fixed_time | text | `HH:mm`. 형식 검사를 건다 |
| excluded | boolean | 일정에서 제외. 삭제와 다르다 |
| location_status | location_status | `unverified`·`verified` |
| lat, lng | double precision | 확인된 좌표만 넣는다 |
| place_provider, place_id, place_url | text | 외부 장소 참조 |
| estimated_cost | integer | 계획 금액(원). null은 미정 |

`kind`의 저장값 `break`는 화면에서 '카페'로 보인다. 라벨만 바꾸고 저장값은 유지해 기존 일정이 깨지지 않게 한 결정이며, 앱의 `STOP_KIND_LABEL`에 같은 주석이 있다.

### accommodation_stays — 숙소

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text | 기본 키 |
| trip_id | text | 여행 삭제 시 함께 삭제 |
| region_id | text | 지역 삭제 시 null |
| name, address | text | |
| check_in | date | |
| check_out | date | 숙박 밤은 `[check_in, check_out)` |
| check_in_time, check_out_time | text | `HH:mm`. 형식 검사를 건다 |
| day_order | integer | 체크인 날짜 목록에서의 자리. null이면 맨 끝 |
| reservation | reservation_state | `unknown`·`reserved`·`not_reserved` |
| memo | text | |
| location_status, lat, lng | | 장소와 같다 |
| place_provider, place_id, place_url | text | |
| estimated_cost | integer | 숙박 전체 금액(원) |

## 설계 결정

### 좌표를 따로 두지 않고 두 컬럼으로 편다

앱 모델은 `location: GeoPoint | null`이지만 표에서는 `lat`·`lng` 두 컬럼으로 편다. PostGIS를 쓰지 않으므로 별도 타입이 필요 없고, 두 값이 항상 함께 있거나 함께 없어야 하므로 `(lat is null) = (lng is null)` 검사를 건다.

### 시각을 time이 아니라 text로 둔다

`time` 타입을 쓰면 `07:00:00`처럼 초가 붙어 앱의 `HH:mm` 형식과 어긋난다. 변환 코드를 양쪽에 두느니 형식 검사를 건 text가 낫다.

### 금액에 null을 허용한다

`null`은 미정이고 `0`은 무료다. 둘을 구분해야 하므로 기본값을 두지 않는다. 음수는 검사로 막는다.

### 지역 삭제는 연결만 끊는다

앱 모델의 `regionId`가 `null`을 허용하므로 표도 같게 둔다. 지역을 지웠다고 그 지역의 장소까지 사라지면 사용자가 일정을 잃는다.

## 접근 제어

네 표 모두 Row Level Security를 켠다. 규칙은 하나다. **본인 여행만 읽고 쓴다.**

`trips`는 `owner_id`를 직접 본다. 딸린 세 표는 `owns_trip(trip_id)` 함수로 여행의 주인을 확인한다. 같은 규칙을 세 번 적지 않기 위해서다.

표 권한은 `authenticated`에만 준다(`20260929000001_trip_grants.sql`). 이 프로젝트는 새 표에 권한을 자동으로 주지 않아, 원격 적용 뒤 비로그인 요청이 `permission denied for table trips`로 막히는 것을 보고 확인했다. 비로그인(`anon`)은 표도 저장 함수도 쓸 수 없다.

```sql
create function owns_trip(target text) returns boolean ...
  select exists (
    select 1 from public.trips
    where id = target and owner_id = (select auth.uid())
  );
```

`auth.uid()`를 `(select auth.uid())`로 감싼 것은 의도적이다. 행마다 다시 부르지 않고 한 번만 계산하게 한다.

## 저장 방식

여행 하나를 저장할 때 **네 표를 한 트랜잭션으로** 갱신한다(2026-09-17 사용자 결정). 앱이 표마다 나눠 호출하면 중간에 끊겼을 때 일정이 반만 저장된 상태로 남는다.

`save_trip(p_trip jsonb, p_base_version integer) returns integer`가 이를 맡는다(`20260929000000_trip_version_and_save.sql`, 2026-09-29).

- 앱 모델 JSON(camelCase)을 그대로 받는다. 변환은 이 함수와 읽기 쪽 `app/.../trips/data/trip-rows.ts`에만 있다.
- `security invoker`라 RLS가 그대로 걸린다. 다른 사람의 여행은 보이지 않으므로 같은 id로 저장하면 새 여행으로 넣으려다 기본 키 중복(`23505`)으로 실패한다.
- **저장 충돌:** 앱은 불러온 버전을 `p_base_version`으로 보낸다. 서버 버전과 다르면 `P0409`로 거절하고, 앱은 '다른 곳에서 먼저 바뀌었어요'와 [새로 불러오기]를 보인다. 새 여행은 0을 보낸다.
- 딸린 표는 지우고 다시 넣는다. 제약(시각 형식, 좌표 짝, 금액 음수 금지)을 어기면 전체가 되돌려진다.
- 로그인하지 않으면 `28000`으로 거절한다.

읽기와 삭제는 함수 없이 표를 직접 쓴다. 목록·한 개 읽기는 `*, trip_regions(*), trip_stops(*), accommodation_stays(*)` 중첩 select, 삭제는 `trips` 행을 지우면 cascade로 딸린 행이 사라진다.

로컬 확인: `supabase/tests/save-trip.local.sql`이 PostgreSQL에 `auth` 스키마를 흉내 내 위 동작을 검사한다.

## 가계부 표 (2026-09-29)

마이그레이션은 `20260929000002_ledger_tables.sql`이고 앱 모델은 `app/src/app/features/expenses/model/ledger.ts`다. 모든 표가 `trip_id`로 여행에 딸리며, 여행을 지우면 함께 사라진다.

| 표 | 담는 것 | 키·제약 |
| --- | --- | --- |
| `trip_ledgers` | 예산 | `trip_id` 기본 키, 예산은 null 또는 0 이상 |
| `ledger_people` | 정산에 참여하는 사람 | `(trip_id, id)` 기본 키, 이름 1~40자 |
| `expenses` | 지출 한 건 | `version`으로 충돌 확인, 결제자는 `ledger_people` 참조, 금액 양수 |
| `expense_splits` | 지출별 사람별 분담 | `(expense_id, person_id)` 기본 키, 분담 합계는 저장 함수가 확인 |
| `settlement_receipts` | 수령 기록과 취소 사유 | 보낸 사람과 받은 사람이 달라야 함, 취소 사유는 비울 수 없음 |

### 동작 단위로 저장한다

여행은 한 번에 통째로 저장하지만, 가계부는 **동작 하나씩** 저장한다(2026-09-29 사용자 결정). 친구 여럿이 동시에 지출을 더하는 경우가 흔하기 때문이다. 가계부 전체를 한 버전으로 묶으면 서로 다른 지출을 더해도 매번 충돌이 난다.

앱은 바꾸기 전/후 가계부를 `ledgerOps`(`app/.../expenses/util/ledger-ops.ts`)로 동작 목록으로 바꾸어 차례로 보낸다. 지출 화면의 저장과 챗봇의 적용·되돌리기가 같은 함수를 쓴다. 사람이 먼저 있어야 외래 키가 맞으므로 순서는 사람 → 예산 → 지출 저장 → 지출 삭제 → 수령 취소 → 수령 추가 → 사람 삭제다. 지우는 사람은 그를 가리키던 기록이 정리된 뒤에 지운다.

| 함수 | 하는 일 |
| --- | --- |
| `add_ledger_person(trip, person)` | 사람을 더하거나 이름을 바꾼다 |
| `remove_ledger_person(trip, person_id)` | 사람을 지운다. '나'는 거절(`P0422`), 기록이 가리키는 사람은 외래 키가 막는다(`23503`). `20260929000003` |
| `save_expense(trip, expense, base_version) → integer` | 지출과 분담을 한 트랜잭션으로 저장하고 새 버전을 돌려준다 |
| `delete_expense(trip, id, base_version)` | 지출을 지운다 |
| `add_receipt` / `cancel_receipt` | 수령을 기록하거나 사유와 함께 취소한다 |
| `set_budget(trip, budget)` | 예산을 바꾸거나 비운다 |

- 모든 함수는 `ledger_guard`로 로그인(`28000`)과 여행 소유(`P0404`)를 먼저 확인한다. `security invoker`라 RLS도 그대로 걸린다.
- 지출은 여행처럼 버전을 확인한다. 새 지출은 0을 보내고, 버전이 다르면 `P0409`로 거절한다. 앱은 새로 불러오기를 안내한다.
- 분담 합계가 지출 금액과 다르면 `P0422`로 거절하고 아무것도 바꾸지 않는다.
- 읽기는 네 표를 동시에 select해 앱 모델로 합친다(`ledger-rows.ts`). 사람 '나'(`self`)가 없으면 처음 읽을 때 한 번 만든다.
- 기기에 있던 가계부는 옮기지 않고 한 번 지운다(2026-09-29 사용자 결정).

로컬 확인: `supabase/tests/ledger.local.sql`이 새 저장·중복 거절·분담 불일치 거절·충돌 삭제 거절·다른 계정 차단·비로그인 거절을 검사한다.

## 계정 삭제

`delete-account` 함수는 `auth.users` 행을 실제로 지운다(soft delete가 아니다). `trips.owner_id`에 `on delete cascade`를 걸어 두었으므로 그 사람의 여행·지역·장소·숙소가 함께 사라진다.

이 설정이 없으면 외래 키 위반으로 **탈퇴 자체가 실패**한다. `docs/HARNESS.md`가 "여행 테이블 연결 전에 삭제 정책을 확장해야 한다"고 적은 것이 이 지점이다.

## 아직 없는 것

- **친구 공유 관련 표.** `TripParticipant`·`TripMember`·`TripInvite`·`TripShare`는 tasks 8.2 범위다. 그때 이 RLS 규칙도 "본인 여행"에서 "참여한 여행"으로 넓혀야 한다.

## 적용 현황

- 2026-09-17 마이그레이션 작성.
- 2026-09-29 원격 적용(`npx supabase db push --linked`). 프로젝트 `wslqgfetdwcmqeztixvs`(PostgreSQL 17.6)에 세 마이그레이션(`20260917000000`, `20260929000000`, `20260929000001`)이 적용됐다.
- 적용 후 확인: 비로그인 요청은 표·저장 함수 모두 `42501`로 거절. 로컬 PostgreSQL 17에서 저장 함수 동작(새 저장, 충돌 거절, 제약 위반 시 전체 되돌림, 다른 계정 차단, 비로그인 거절)을 확인했다.
- 2026-09-29 가계부 마이그레이션(`20260929000002`) 원격 적용. 비로그인 요청은 가계부 표 다섯 개와 저장 함수 모두 `42501`로 거절됨을 확인했다. 적용 전에는 표가 없어 가계부 화면에서 404가 났다.
- 2026-09-29 사람 삭제 함수(`20260929000003`) 원격 적용. 비로그인 호출은 `42501`로 거절됨을 확인했다.
- 2026-09-29 AI 사용 횟수(`20260929000004`) 원격 적용. `ai_usage`(사용자·한국 날짜·기능별 횟수)와 `ai_quota_overrides`(사용자별 예외 한도)는 RLS를 켜고 사용자 권한을 주지 않는다. `consume_ai_quota`·`refund_ai_quota`는 `security definer`이며 `service_role`만 실행한다. 한도 초과는 `P0429`(detail에 적용 한도). 비로그인 요청은 `42501`로 거절됨을 확인했다. 자세한 규칙은 [AI-PLANNING.md](../AI-PLANNING.md).
- 아직 확인할 것: 실제 계정 두 개로 서로의 여행이 안 보이는지, 같은 계정 다른 기기 조회, 두 탭 충돌 알림, 계정 삭제 시 여행·가계부 연쇄 삭제, 실제 계정으로 지출 저장·수정·삭제와 챗봇 지출 적용.
