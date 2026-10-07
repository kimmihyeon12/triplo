# 데이터베이스 구조

여행과 가계부를 계정별로 저장하는 표 구조다. 원본 마이그레이션은 `supabase/migrations/`에 있고, 앱 모델은 `app/src/app/features/trips/model/trip.ts`다. 이 문서는 두 곳의 대응 관계와 설계 결정을 기록한다.

2026-09-17 작성, 2026-09-30 소스 대조. 아래 '적용 현황'은 당시 원격 실행 기록이며 이번 문서 갱신에서 원격 상태를 재조회하지 않았다. 구현 SQL과 원격 적용 완료를 구분한다.

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

2026-09-29부터 규칙은 **참여한 여행만 읽고, 쓰기는 함수로만 한다**이다(`20260929000005_trip_members.sql`). 그 전에는 '본인 여행만 읽고 쓴다'였다.

- **읽기:** 모든 여행·가계부 표는 `is_trip_member(trip_id)`로 멤버만 읽는다. 개인 지출과 그 분담은 쓴 사람(`expenses.created_by`)만 본다. `trip_members`는 같은 여행 멤버끼리, `trip_invites`는 주인만 읽는다.
- **쓰기:** `authenticated`의 insert·update·delete 권한을 모두 거뒀다. 여행 저장(`save_trip`)·삭제(`delete_trip`)·가계부 함수·초대 함수만 쓴다. 이 함수들은 `security definer`라 RLS를 건너뛰므로 **함수 안에서 멤버·주인을 확인한다.** 버전·분담 합계 검사를 표 직접 쓰기로 우회하지 못하게 하기 위해서다.
- **확인 함수:** `is_trip_member`·`is_trip_owner`도 `security definer`다. 정책이 `trip_members`를 읽을 때 그 정책이 다시 걸려 돌지 않게 한다.
- **비로그인(`anon`):** 표 권한이 없고, 초대 미리보기(`preview_trip_invite`)만 부를 수 있다.

`auth.uid()`를 `(select auth.uid())`로 감싼 것은 의도적이다. 행마다 다시 부르지 않고 한 번만 계산하게 한다.

### 채팅 기록 (2026-10-07)

`chat_messages`: 계정·메시지 id(기본 키 둘), 여행(목록 대화는 null)·역할·종류·본문(4000자)·부가 정보 `extra`(확인 카드 초안·칩·링크, 64KB)·메시지 시각. 본인 행만 읽는다. `authenticated`에는 `select`만 준다. 여행을 지우거나 탈퇴하면 함께 지워진다. 여행에서 나가도 본인 대화는 남는다.

| 함수 | 누가 | 하는 일 |
| --- | --- | --- |
| `append_chat_message(trip_id, message)` | 로그인한 사람, 여행 대화면 그 여행 멤버 | 한 줄을 남긴다. 같은 id는 무시. 그 대화의 최근 200줄 밖은 지운다 |
| `import_chat_threads(threads)` → 옮긴 줄 수 | 로그인한 사람 | 기기 기록 옮기기. 서버 대화에 메시지 id로 합치고 이미 있는 줄·남길 수 없는 여행·깨진 줄은 건너뛴다. 대화마다 최근 200줄로 자른다. 한 번에 2MB |
| `clear_chat(trip_id)` | 본인 | 그 대화를 지운다 |

내부 도우미 `insert_chat_message`·`trim_chat_thread`·`can_chat_in`은 직접 부를 수 없다. 오류 코드: 형식·크기 `P0400`, 비로그인·멤버 아님 `42501`. 로컬 확인: `supabase/tests/chat-messages.local.sql`.

### 공지·문의 (2026-10-01)

| 표 | 담는 것 · 읽기 규칙 |
| --- | --- |
| `notices` | 제목(1~100자)·본문(1~5000자)·상태(초안·발행)·자동 생성 여부·배포 태그·발행 시각. 발행된 것은 로그인 사용자 모두, 초안은 관리자만 읽는다 |
| `notice_reads` | 사용자별로 읽은 공지. 본인 행만 읽는다 |
| `inquiries` | 보낸 사람·서버가 채운 닉네임·종류·본문(1~1000자)·상태·앱 버전·기기 정보·답변 확인 시각. 본인과 관리자만 읽는다 |
| `inquiry_replies` | 답변 본문(1~2000자)·작성자 역할·시각. 그 문의를 읽을 수 있는 사람만 읽는다 |

네 표 모두 `authenticated`에 `select`만 주고 쓰기는 아래 함수로만 한다. 계정을 지우면 문의·답변·읽음 기록이 함께 지워진다.

| 함수 | 누가 | 하는 일 |
| --- | --- | --- |
| `send_inquiry(kind, body, app_version, user_agent)` → id | 로그인한 사람 | 문의를 남긴다. 닉네임은 계정 정보에서 서버가 채운다. 한 사람이 최근 1시간에 5건까지 보낼 수 있고 넘으면 `P0429`(2026-10-07 `20261007000000`) |
| `mark_inquiry_read(id, seen_at?)` | 본인 | 답변 확인 시각을 화면에 보인 마지막 답변 시각(`seen_at`)으로 한다. 그 뒤에 달린 답변은 새 답변으로 남는다. `seen_at`이 없으면 지금 시각, 미래 시각은 지금으로 자르고 확인 시각은 뒤로 돌리지 않는다(2026-10-01 `20261001100000`). 남의 문의면 `P0404` |
| `mark_notices_read()` | 로그인한 사람 | 지금 발행된 공지를 모두 읽음으로 기록한다 |
| `admin_save_notice(id, title, body)` → id | 관리자 | id가 없으면 초안을 만들고 있으면 고친다 |
| `admin_set_notice_published(id, published)` | 관리자 | 발행하거나 초안으로 돌린다 |
| `admin_delete_notice(id)` | 관리자 | 공지를 지운다 |
| `admin_reply_inquiry(id, body)` → id | 관리자 | 답변을 더하고 답변 완료로 바꾼다 |
| `admin_set_inquiry_status(id, status)` | 관리자 | 확인 중·접수됨으로 바꾼다 |
| `release_notice_draft(tag, title, body)` → id 또는 null | 배포 담당(CLI, DB 소유자) | 배포 공지 초안을 만든다(`generated`=true). 같은 태그의 자동 초안이 있으면 만들지 않고 null. 앱 사용자·관리자 화면은 부를 수 없다(2026-10-01 `20261001110000`) |

오류 코드: 길이·값 `P0400`, 없는 대상 `P0404`, 문의 횟수 초과 `P0429`, 권한 없음 `42501`. 내부 도우미 `require_admin()`·`clean_text()`는 다른 함수 안에서만 쓰며 `authenticated`가 직접 부를 수 없다(2026-10-07). 로컬 확인: `supabase/tests/support.local.sql`.

### AI 호출 기록과 사용량 집계 (2026-10-07)

`ai_calls(at, kind, model, ok, input_tokens, output_tokens)`는 서버 함수(`ai-plan`·`ai-chat`·`receipt-scan`)가 Gemini를 실제로 부를 때마다 service_role로 한 줄 넣는다. 실패·시간 초과도 남긴다. 사용자 id는 없다. `ai_usage`(사용자별 요청 횟수, 실패 시 되돌림)와 다르다. RLS를 켜고 `anon`·`authenticated` 권한을 모두 거둬 사용자는 읽지 못한다. pg_cron이 매일 90일 지난 줄을 지운다(`20261007200001`).

`admin_usage_summary()` → jsonb는 관리자만 부른다(아니면 `42501`). 태평양 시간 오늘 호출·실패 수, 한국 시간 이번 달 기능·모델별 호출·토큰, DB 크기, `storage.objects` 크기 합, 최근 30일 로그인 사용자를 돌려준다. 무료 한도·단가와 견주는 일은 앱(`features/admin/model/usage.ts`)이 한다. 마이그레이션 `20261007200000_admin_usage.sql`, 로컬 확인 `supabase/tests/admin-usage.local.sql`.

### 관리자 판별

`profiles(id, role)`은 역할 전용 표다. 행이 없으면 일반 사용자다. 본인 행 조회만 허용하고 쓰기 권한과 정책은 두지 않아 사용자가 스스로 관리자가 될 수 없다. 계정을 지우면 함께 지운다.

후속 공지·문의 표의 RLS는 `is_admin()`을 호출한다. `security definer`라 RLS와 무관하게 역할을 읽고, `search_path`를 비워 둔다. 실행 권한은 `authenticated`만 가진다. Supabase의 기본 권한 설정이 새 표·함수에 `anon`·`authenticated` 권한을 직접 줄 수 있어 마이그레이션에서 명시적으로 거둔다.

관리자 부여는 화면이 아니라 SQL로 직접 한다. 대상 계정이 한 번 이상 로그인해 있어야 한다. 이메일은 저장소에 적지 않는다.

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = '<관리자 이메일>'
on conflict (id) do update set role = excluded.role;
```

## 멤버와 초대 (2026-09-29)

| 표 | 담는 것 |
| --- | --- |
| `trip_members` | 여행·사용자·역할(`owner`·`editor`)·합류 시점 닉네임. 기존 여행은 주인 행으로 채웠다. 새 여행은 `save_trip`이 주인 행을 넣는다 |
| `trip_invites` | 여행마다 하나(`trip_id` 기본 키). 코드의 SHA-256 해시·만든 사람·7일 만료. 새로 만들면 앞 코드는 무효, 지우면 취소 |

| 함수 | 누가 | 하는 일 |
| --- | --- | --- |
| `create_trip_invite(trip)` → 코드 | 주인 | 헷갈리는 글자를 뺀 8자 코드를 만들어 해시만 저장하고 코드를 돌려준다. 코드는 다시 볼 수 없다 |
| `revoke_trip_invite(trip)` | 주인 | 초대를 지운다 |
| `preview_trip_invite(code)` → json | 누구나 | 제목·기간·지역·장소(이름·분류·날짜·순서·고정 시각)·숙소(이름·체크인·체크아웃)·주인 닉네임. 메모·예약·금액·주소·가계부·여행 id는 없다 |
| `join_trip(code)` → 여행 id | 로그인한 사람 | editor로 넣는다(이미 멤버면 그대로). 처음 합류하면 가계부에 그 사람 이름을 더하고, 가계부의 '나'를 주인 닉네임으로 바꾼다 |
| `leave_trip(trip)` | 주인 아닌 멤버 | 스스로 나간다. 주인은 `P0422` |
| `remove_trip_member(trip, user)` | 주인 | 멤버를 뺀다. 빠진 사람이 쓴 지출은 남는다 |
| `delete_trip(trip)` | 주인 | 여행을 지운다(cascade) |

- 코드는 대문자로 바꾸고 문자·숫자만 남겨 해시한다(`abcd-efgh`도 같다). 없는 코드·만료·취소는 모두 `invite_invalid`(`P0404`)로 같게 알린다.
- 남의 여행 id로 `save_trip`을 부르면 `P0404`다(예전에는 기본 키 중복 `23505`).
- 개인 지출은 쓴 사람만 고치고 지운다. 남의 공동 지출을 개인으로 돌려 감추는 것도 막는다.
- `expense_splits (expense_id, trip_id)`가 `expenses (id, trip_id)`를 가리켜 분담이 다른 여행의 지출에 달리지 않는다.

로컬 확인: `supabase/tests/trip-members.local.sql`. 기존 `save-trip.local.sql`·`ledger.local.sql`도 이 마이그레이션을 포함해 주인 동작이 그대로인지 확인한다.

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
| `add_receipt` / `cancel_receipt` | 수령을 기록하거나 사유와 함께 취소한다. 기록은 여행별로 직렬화하고 남은 잔액 안에서만 받는다. `20260930000000` |
| `set_budget(trip, budget)` | 예산을 바꾸거나 비운다 |

- 모든 함수는 `ledger_guard`로 로그인(`28000`)과 여행 소유(`P0404`)를 먼저 확인한다. `security invoker`라 RLS도 그대로 걸린다.
- 지출은 여행처럼 버전을 확인한다. 새 지출은 0을 보내고, 버전이 다르면 `P0409`로 거절한다. 앱은 새로 불러오기를 안내한다.
- 분담 합계가 지출 금액과 다르면 `P0422`로 거절하고 아무것도 바꾸지 않는다.
- 읽기는 네 표를 동시에 select해 앱 모델로 합친다(`ledger-rows.ts`). 사람 '나'(`self`)가 없으면 처음 읽을 때 한 번 만든다.
- 기기에 있던 가계부는 옮기지 않고 한 번 지운다(2026-09-29 사용자 결정).
- 수령 기록(`add_receipt`)은 여행 가계부 단위 트랜잭션 잠금(`pg_advisory_xact_lock`)을 잡고, 앱의 `balances()`와 같은 식(공동 지출의 결제액 − 분담액, 취소되지 않은 수령의 보낸 금액 + · 받은 금액 −)으로 최신 잔액을 계산한다. 보내는 사람의 남은 빚이나 받는 사람의 남은 받을 돈을 넘으면 `P0409`로 거절하고, 같은 id의 재요청은 새로 기록하지 않는다. 두 브라우저가 같은 미수금을 동시에 수령 처리해 두 번 기록되던 문제를 막는다(2026-09-30 감리 P1-04). 잔액 계산 함수 `ledger_balance`는 로그인한 사람이 직접 부르지 못한다.

로컬 확인: `supabase/tests/ledger.local.sql`이 새 저장·중복 거절·분담 불일치 거절·충돌 삭제 거절·다른 계정 차단·비로그인 거절을 검사한다. `supabase/tests/receipt.local.sql`은 잔액 초과·반대 방향 거절, 부분 수령, 같은 id 재요청 무시, 취소 뒤 재기록을 검사하고, 파일 끝의 상태에서 두 세션이 같은 미수금을 동시에 수령하면 하나만 기록되는지 확인한다.

## 계정 삭제

`delete-account` 함수는 `auth.users` 행을 실제로 지운다(soft delete가 아니다). `trips.owner_id`에 `on delete cascade`를 걸어 두었으므로 그 사람의 여행·지역·장소·숙소가 함께 사라진다.

탈퇴 전 넘기기(2026-10-01 `20261001140000`): `delete-account`는 계정을 지우기 전에 `hand_over_trips(p_user)`(서비스 권한만 실행)를 부른다. 다른 멤버가 있는 내 여행은 가장 먼저 합류한 멤버(`joined_at`, `user_id` 순)가 주인이 되고 내 멤버 행은 지운다. 혼자 쓰던 여행만 연쇄 삭제된다. 넘기기가 실패하면 계정을 지우지 않는다. 확인 화면은 `account_deletion_summary()`(본인 기준 지울 여행·넘길 여행 수)를 읽는다. 로컬 확인: `supabase/tests/account-deletion.local.sql`.

삭제 연쇄는 SQL 기준이며 실제 계정 탈퇴가 모든 관련 데이터에 미치는 영향은 별도 검증한다. 함수 배포·런타임 활성화·사진 Storage 등 향후 저장 대상의 정리 정책은 [HARNESS.md](../HARNESS.md)를 따른다.

가계부 사람(`ledger_people`)을 가리키는 외래 키 네 개(지출의 낸 사람, 분담의 사람, 정산의 보낸·받는 사람)는 트랜잭션 끝에 검사한다(`deferrable initially deferred`, 2026-10-01 `20261001130000`). 여행이나 계정을 지울 때 사람 행이 분담·지출보다 먼저 지워지면 즉시 검사에서 막혀, 함께 쓰는 여행에 지출이 있으면 여행 삭제와 회원탈퇴가 실패했다. 지출에 쓰인 사람을 따로 지우는 것은 지금처럼 막힌다. 로컬 확인: `supabase/tests/delete-cascade.local.sql`.

## 아직 없는 것

- **보기 전용 공유 링크 스냅숏(tasks 8.3).** 지금 초대 미리보기는 원본을 줄여 보여 줄 뿐 따로 저장한 스냅숏이 아니다.
- **주인 승인·코드 시도 제한.** 2026-09-29 결정으로 이번 범위에서 뺐다.

## 적용 현황

현재 소스에는 아래 원격 기록에 이어 `20260929000007_preview_my_role.sql`과 `20260930000000_receipt_balance_guard.sql`도 있다. 이번 점검에서는 두 파일의 존재와 구현을 확인했으며 원격 적용 여부는 확인하지 않았다. 수령 검증은 여행 가계부 단위 잠금·서버 잔액 검사를 구현하지만 실제 동시 요청 검증과는 구분한다.

- 2026-09-17 마이그레이션 작성.
- 2026-09-29 원격 적용(`npx supabase db push --linked`). 프로젝트 `wslqgfetdwcmqeztixvs`(PostgreSQL 17.6)에 세 마이그레이션(`20260917000000`, `20260929000000`, `20260929000001`)이 적용됐다.
- 적용 후 확인: 비로그인 요청은 표·저장 함수 모두 `42501`로 거절. 로컬 PostgreSQL 17에서 저장 함수 동작(새 저장, 충돌 거절, 제약 위반 시 전체 되돌림, 다른 계정 차단, 비로그인 거절)을 확인했다.
- 2026-09-29 가계부 마이그레이션(`20260929000002`) 원격 적용. 비로그인 요청은 가계부 표 다섯 개와 저장 함수 모두 `42501`로 거절됨을 확인했다. 적용 전에는 표가 없어 가계부 화면에서 404가 났다.
- 2026-09-29 사람 삭제 함수(`20260929000003`) 원격 적용. 비로그인 호출은 `42501`로 거절됨을 확인했다.
- 2026-09-29 AI 사용 횟수(`20260929000004`) 원격 적용. `ai_usage`(사용자·한국 날짜·기능별 횟수)와 `ai_quota_overrides`(사용자별 예외 한도)는 RLS를 켜고 사용자 권한을 주지 않는다. `consume_ai_quota`·`refund_ai_quota`는 `security definer`이며 `service_role`만 실행한다. 한도 초과는 `P0429`(detail에 적용 한도). 비로그인 요청은 `42501`로 거절됨을 확인했다. 자세한 규칙은 [AI-PLANNING.md](../AI-PLANNING.md).
- 2026-09-29 친구 초대·함께 편집(`20260929000005`) 원격 적용, v0.9.0 배포. 비로그인 요청은 `trips`·`trip_members`·`trip_invites`·`expenses` 표와 `save_trip`·`join_trip`·`delete_trip`이 모두 `42501`, 초대 미리보기만 열려 잘못된 코드에 `invite_invalid`를 돌려줌을 확인했다. 실제 두 계정의 초대·합류·함께 편집은 사용자 확인 대상이다.
- 2026-09-29 v0.9.0 배포 직후 가계부를 불러오지 못했다. 분담 → 지출 외래 키가 둘이 되어 PostgREST가 지출·분담을 함께 읽을 관계를 고르지 못했기 때문이다(PGRST201). 옛 `expense_splits_expense_id_fkey`를 지우는 `20260929000006`을 원격 적용하고, 같은 요청이 관계 오류 없이 권한 확인까지 가는 것을 확인했다. 표에 외래 키를 더할 때는 PostgREST가 같은 두 표 사이의 관계를 하나로 고를 수 있는지 함께 본다.
- 2026-09-29 관리자 판별 마이그레이션 작성, 로컬 PostgreSQL 임시 DB 검증. 2026-09-30 번호를 `20260930000002_profiles_role.sql`로 바꿔 원격 적용하고 관리자 1명을 부여했다. 비로그인 요청은 `is_admin`·`profiles` 모두 `42501`로 거절됨을 확인했다.
- 아직 확인할 것: 실제 계정 두 개로 서로의 여행이 안 보이는지, 같은 계정 다른 기기 조회, 두 탭 충돌 알림, 계정 삭제 시 여행·가계부 연쇄 삭제, 실제 계정으로 지출 저장·수정·삭제와 챗봇 지출 적용.
