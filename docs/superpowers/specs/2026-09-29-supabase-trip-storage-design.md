# 설계: 여행을 Supabase에 저장한다

2026-09-29 작성. 브랜치 `feat/supabase-trips`.

## 목적

여행 데이터를 브라우저 저장소(localStorage)에서 Supabase 서버로 옮긴다. 로그인한 사람은 어느 기기에서 열어도 같은 여행을 보고, 다른 계정의 여행은 볼 수 없다. 친구 초대·공동 편집(OpenSpec 8.2)과 가계부 서버 저장은 이 작업이 끝난 뒤 따로 한다.

## 사용자 결정 (2026-09-29)

| 질문 | 결정 |
| --- | --- |
| 이번 범위 | 여행(정보·지역·장소·숙소)만. 가계부·초대·문의·채팅 기록은 다음 단계 |
| 기기에 있던 여행 | 계정으로 옮기지 않고 모두 지운다. 그 여행에 달린 기기 가계부도 지운다 |
| 오프라인 | 서버만 쓴다. 기기 사본·동기화는 만들지 않는다 |
| 저장 방식 | 서버 함수 하나가 여행 전체를 한 트랜잭션으로 저장한다 |

충돌 처리는 기획안의 공동 편집·저장 명령 결정(버전 확인, 입력 보존)과 OpenSpec 9.5를 따른다. 버전이 어긋난 저장은 서버가 거절하고, 앱은 입력을 남긴 채 알린다.

## 1. 데이터베이스

기존 마이그레이션 `20260917000000_create_trip_tables.sql`은 그대로 두고 새 마이그레이션을 더한다.

- `trip_regions.region_code text` 추가. 앱 모델의 `regionCode`(통계 집계 키)다. 기존 표 설계에서 빠져 있었다.
- `trips.version integer not null default 0` 추가. 저장이 성공할 때마다 1 오른다.
- `save_trip(p_trip jsonb, p_base_version integer) returns integer` 함수 추가(아래 2절).

두 마이그레이션을 원격 프로젝트 `wslqgfetdwcmqeztixvs`에 `npx supabase db push`로 적용한다.

## 2. 서버 저장 함수 `save_trip`

`security invoker`로 만들어 RLS가 그대로 걸리게 한다. 호출자는 로그인한 사용자다.

1. `auth.uid()`가 없으면 거절한다.
2. `trips`에서 `p_trip.id` 행을 `for update`로 잠근다.
   - 행이 없으면 새 여행이다. `p_base_version`이 0이어야 하고, `owner_id = auth.uid()`, `version = 1`로 넣는다.
   - 행이 있으면 RLS 때문에 본인 여행만 보인다. `version <> p_base_version`이면 `conflict` 오류(SQLSTATE `P0409`)로 거절한다.
3. 여행 정보를 고치고, 지역·장소·숙소는 그 여행의 행을 지운 뒤 JSON에서 다시 넣는다. 지역을 먼저 넣어 장소·숙소의 `region_id` 외래 키가 맞게 한다.
4. `version`을 1 올리고 `updated_at`을 앱이 보낸 값으로 둔다. 새 버전 번호를 돌려준다.

한 함수 호출이 한 트랜잭션이므로 중간에 실패하면 아무것도 바뀌지 않는다. 표의 check 제약(시각 형식, 좌표 짝, 금액 음수 금지)을 어기면 전체가 되돌려진다.

읽기와 삭제는 함수 없이 표를 직접 쓴다.
- 목록: `trips`를 `updated_at desc`로 읽고 딸린 표를 함께 가져온다(PostgREST 중첩 select).
- 한 개: 같은 select를 `id`로 거른다.
- 삭제: `trips` 행을 지우면 딸린 행은 cascade로 사라진다.

## 3. 앱

**`SupabaseTripRepository`** (`features/trips/data/`)
- 기존 `TripRepository` 인터페이스(`list`·`get`·`save`·`remove`)를 구현한다. 화면과 `TripEditorStore`는 인터페이스만 쓰므로 거의 바뀌지 않는다.
- 행 ↔ 모델 변환은 순수 함수(`trip-rows.ts`)로 분리해 단위 테스트한다. snake_case ↔ camelCase, `lat/lng` ↔ `location`, `place_provider/place_id/place_url` ↔ `placeRef`.
- 불러온 여행마다 서버 버전을 기억한다. 저장할 때 그 값을 `p_base_version`으로 보내고, 성공하면 돌려받은 새 버전으로 바꾼다. 모델(`Trip`)에는 버전을 넣지 않고 저장소 안에서 id별로 들고 있어 화면 코드를 바꾸지 않는다.
- 충돌이면 `TripConflictError`를, 그 밖의 실패는 기존과 같은 저장 실패 오류를 던진다.

**`AuthStore`**
- 지금은 서버 함수 호출(`callFunction`)만 밖으로 열려 있다. 저장소가 쓸 Supabase 클라이언트를 돌려주는 메서드를 하나 연다. 클라이언트가 없으면(설정 없음) 저장소는 "서버에 연결되지 않았어요" 오류를 낸다.
- 로그인·로그아웃으로 사용자가 바뀌면 `PendingDraftRegistry.changeSession`을 부른다. 이전 계정의 저장 대기열이 다음 계정으로 넘어가지 않게 한다. 지금은 테스트에서만 불린다.

**제공자 연결** (`app.config.ts`)
- 실행 앱은 `SupabaseTripRepository`, 테스트 앱(`environment.isTest`)은 지금의 `LocalStorageTripRepository`를 쓴다. e2e는 외부 서버 없이 그대로 돈다.

## 4. 충돌·실패 화면

- **충돌:** 저장 상태 자리에 "다른 곳에서 먼저 바뀌었어요"와 [새로 불러오기]를 보인다. 입력한 내용은 화면에 남아 있어 옮겨 적을 수 있다. 새로 불러오기를 누르면 서버 최신본을 받고 버전을 새로 기억한다.
- **연결 실패:** 지금처럼 "저장하지 못했어요"와 다시 시도. `PendingDraftRegistry`가 실패한 저장을 보관한다.
- **목록을 못 불러옴:** 여행 목록 자리에 이유와 [다시 시도]를 보인다. 빈 목록("아직 여행이 없어요")으로 잘못 보이지 않게 한다.

## 5. 기기 데이터 정리

서버 저장소가 처음 쓰일 때 한 번, 기기의 `tc.trips.v1`(여행)과 `tc.trips.v1.ledger.*`(그 여행들의 가계부)를 지우고 `tc.trips.v1.migrated = 'server'` 표시를 남긴다. 표시가 있으면 다시 지우지 않는다. 테스트 앱은 이 정리를 하지 않는다.

가계부는 이번 범위에서 계속 기기에 저장한다. 서버 여행에 새로 쓰는 가계부는 서버 여행 id를 키로 기기에 남는다.

## 5-1. 범위 밖

- 친구 초대·공동 편집, 참여자 권한(OpenSpec 8.2)
- 가계부·문의·채팅 기록 서버 저장
- 오프라인 편집·동기화
- 실시간 반영(다른 기기에서 바꾼 내용이 바로 보이는 것). 들어올 때와 새로 불러오기로 맞춘다

## 6. 검증

- **서버 함수:** 로컬 Supabase가 없으므로 원격에 적용한 뒤 SQL로 확인한다. 새 여행 저장, 버전 불일치 거절, 제약 위반 시 전체 되돌림, 다른 계정 여행 저장 거절.
- **앱 단위 테스트:** 행 ↔ 모델 변환 왕복, 버전 기억과 충돌 오류 변환, 기기 데이터 정리가 한 번만 도는지.
- **실제 계정:** 계정 두 개로 서로의 여행이 안 보이는지, 같은 계정을 다른 브라우저에서 열어 같은 여행이 보이는지, 두 탭에서 고쳐 충돌 알림이 뜨는지 확인한다.
- **회귀:** 기존 단위 테스트와 e2e(테스트 앱은 기기 저장소를 쓰므로 그대로 돌아야 한다).

## 문서 갱신

- `docs/architecture/DATABASE.md`: 버전·`region_code`·`save_trip`·적용 현황
- `docs/DEVELOPMENT.md`: 현재 단계(여행 서버 저장)
- OpenSpec `plan-travel-companion-mvp/tasks.md`: 4.2·4.3·4.4·9.5 진행 표시(4.3의 "기기 초안 가져오기"는 사용자 결정으로 "기기 데이터 삭제"로 바뀜)
- `docs/기획안-v0.1.md`: 기기 여행을 옮기지 않고 지운다는 결정
