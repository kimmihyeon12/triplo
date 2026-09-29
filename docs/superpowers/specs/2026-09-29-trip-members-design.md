# 설계: 친구 초대와 함께 편집

2026-09-29 작성. 브랜치 `feat/trip-members`(develop, v0.8.1 위).

## 목적

여행과 가계부를 친구와 함께 쓴다. 주인이 만든 초대 링크로 들어온 친구는 일정과 가계부를 함께 고친다. 같은 단계에서 미뤄 둔 DB 권한 보강(표 직접 쓰기 차단)을 한다.

## 사용자 결정 (2026-09-29)

| 질문 | 결정 |
| --- | --- |
| 합류한 친구의 권한 | 일정·가계부 함께 편집(명세 488의 새 요구). 주인 승인 없이 링크로 합류 |
| 링크 하나의 쓰임 | 로그인 전에는 보기 전용 미리보기, 로그인 후 [함께하기]로 합류 |
| 이번에 뺄 것 | 주인 승인, 코드 입력 시도 제한, 실시간 동기화, 사진 |

기존 기획안 27·28절과 명세 30행의 '일정 쓰기는 소유자로 제한·승인형'은 이 결정으로 대체한다.

## 1. 데이터베이스 (`20260929000005_trip_members.sql`)

### 새 표

```text
trip_members  (trip_id → trips on delete cascade, user_id → auth.users on delete cascade,
               role 'owner' | 'editor', nickname text, joined_at, pk (trip_id, user_id))
trip_invites  (trip_id pk → trips on delete cascade, code_hash text unique,
               created_by → auth.users on delete cascade, expires_at, created_at)
```

- 여행마다 초대 링크는 하나만 살아 있다(`trip_id` 기본 키). 새로 만들면 앞 링크는 무효가 된다. 지우면 취소다.
- 코드는 그대로 두지 않고 SHA-256 해시만 저장한다. 그래서 주인도 나중에 같은 링크를 다시 볼 수 없고, 필요하면 새로 만든다.
- 기존 여행은 주인을 `owner` 행으로 채운다. 닉네임은 `auth.users.raw_user_meta_data->>'travel_nickname'`.
- `expenses.created_by uuid`를 더하고 기존 행은 여행 주인으로 채운다. 개인 지출은 쓴 사람만 본다.
- `expenses (id, trip_id)` 유일 제약과 `expense_splits (expense_id, trip_id) → expenses (id, trip_id)` 외래 키로 분담이 지출과 같은 여행에만 달리게 한다.

### 접근 규칙

- `is_trip_member(trip_id)`, `is_trip_owner(trip_id)`: `security definer`, `search_path = ''`. 정책이 `trip_members`를 읽을 때 정책이 다시 걸려 돌지 않게 definer로 둔다.
- 읽기(select) 정책: 여행·지역·장소·숙소·가계부 표는 `is_trip_member`. 지출은 여기에 `not personal or created_by = auth.uid()`, 분담은 보이는 지출의 분담만. `trip_members`는 같은 여행 멤버끼리, `trip_invites`는 주인만.
- `authenticated`의 insert·update·delete 권한을 모든 여행·가계부 표에서 거둔다. 쓰기는 아래 함수로만 한다. `anon`에게는 표 권한이 없다.

### 함수

기존 함수는 모두 `security definer`로 바꾸고 멤버 확인을 함수 안에서 한다(definer는 RLS를 건너뛰므로).

| 함수 | 누가 | 하는 일 |
| --- | --- | --- |
| `save_trip` | 새 여행은 누구나, 기존 여행은 멤버 | 새 여행이면 주인 행도 넣는다. 멤버가 아니면 `P0404` |
| `delete_trip(trip_id)` | 주인 | 여행을 지운다. 딸린 행은 cascade |
| `ledger_guard` 외 가계부 함수 7개 | 멤버 | 확인을 `is_trip_member`로. 남의 개인 지출은 고치거나 지우면 `P0404` |
| `create_trip_invite(trip_id) → text` | 주인 | 8자 코드(헷갈리는 글자 뺀 대문자·숫자)를 만들고 7일 뒤 만료로 저장, 코드를 돌려준다 |
| `revoke_trip_invite(trip_id)` | 주인 | 링크를 지운다 |
| `preview_trip_invite(code) → jsonb` | 누구나(anon 포함) | 유효하면 제목·기간·지역·장소(이름·분류·날짜·순서·고정 시각)·숙소(이름·체크인·체크아웃)와 주인 닉네임을 돌려준다. 메모·예약번호·금액·가계부·주소는 빼고, 일정에서 뺀 장소도 뺀다 |
| `join_trip(code) → text` | 로그인한 사람 | 멤버(editor)로 넣고 여행 id를 돌려준다. 이미 멤버면 그대로. 가계부에 그 사람 이름(닉네임)을 한 명 더한다 |
| `leave_trip(trip_id)` | 주인이 아닌 멤버 | 자신을 뺀다 |
| `remove_trip_member(trip_id, user_id)` | 주인 | 멤버를 뺀다. 주인은 뺄 수 없다 |

- 코드는 받을 때 대문자로 바꾸고 문자·숫자만 남긴다(`abcd-efgh`도 된다).
- 없는 코드·만료·취소는 모두 같은 오류 `invite_invalid`(`P0404`)로, 여행 정보를 드러내지 않는다.
- 빠진 멤버는 곧바로 모든 읽기·쓰기가 막힌다. 그가 쓴 지출은 남는다.

## 2. 앱

- **여행 모델:** `Trip.sharing?: { role: 'owner' | 'editor'; members: { userId, nickname, role }[] }`. 서버 읽기에서만 채우고 기기 저장소와 `save_trip`은 무시한다.
- **여행 목록:** 내가 주인이 아닌 여행에 '함께' 라벨.
- **여행 상세:** 머리글의 사람 목록을 실제 멤버로. 멤버에게는 [삭제] 대신 [나가기].
- **삭제:** `delete_trip` 함수로.
- **초대 화면(`/trips/:id/invite`):** 주인은 [초대 링크 만들기] → 링크 표시·[복사]·[새로 만들기]·[링크 취소], 만료 일시. 멤버 목록과 주인의 [빼기]. 멤버는 목록과 [나가기]. 기기 데이터 미리보기 버튼은 없앤다.
- **합류 화면(`/join/:code`):** 로그인 없이 연다. 미리보기(보기 전용)를 보여 주고, 로그인했으면 [함께하기], 아니면 [로그인하고 함께하기](로그인 뒤 이 주소로 돌아온다). 잘못된 링크는 한 가지 안내.
- **가계부의 '나':** 친구가 처음 합류할 때 서버가 `self`('나')의 이름을 주인 닉네임으로 바꾼다. 함께 쓰는 가계부에서 '나'는 보는 사람마다 뜻이 달라지기 때문이다. 표시만 바꾸면 이름이 쓰이는 곳마다 고쳐야 하고, 가계부 값을 바꾸면 다음 저장이 서버 이름을 바꿔 버린다(2026-09-29 구현 중 결정).
- **저장 충돌:** 기존 버전 확인(`P0409`)과 [새로 불러오기]가 두 사람의 동시 저장을 처리한다.
- **테스트 앱:** 기기 구현(`LocalTripMembers`)은 항상 주인이고 초대 코드 `TEST-CODE`를 준다. 합류 화면은 테스트 픽스처로 미리보기를 보여 준다.

## 3. 범위 밖

주인 승인, 코드 입력 시도 제한, 실시간 동기화, 사진 공유, 멤버 닉네임 변경 반영(합류 시점 닉네임을 쓴다), 공유 링크 스냅숏(8.3의 별도 보기 전용 링크).

## 4. 검증

- 로컬 PostgreSQL `supabase/tests/trip-members.local.sql`: 주인 행 채우기, 초대 만들기·미리보기(민감 필드 없음)·합류·중복 합류, 만료·취소·잘못된 코드 같은 오류, 멤버의 일정·가계부 저장, 남의 개인 지출 숨김·수정 거절, 멤버의 삭제·초대 거절, 나가기·빼기 뒤 접근 거절, 표 직접 쓰기 거절, 분담 여행 불일치 거절, anon은 미리보기만.
- 앱 단위: 행 변환(sharing), 저장소 함수 호출, 초대·합류 화면 상태, '나' 표시.
- 원격: 적용 전 확인. 적용 뒤 비로그인이 표·쓰기 함수에서 42501, 미리보기는 잘못된 코드에 같은 오류. 실제 두 계정 확인은 사용자.

## 문서 갱신

`docs/architecture/DATABASE.md`(두 표·함수·권한 모델), `docs/기획안-v0.1.md` 40절, OpenSpec `tasks.md` 8.2·8.5·8.6과 명세 30행의 대체 표시, `docs/DEVELOPMENT.md`.
