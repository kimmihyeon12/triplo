# 설계: 사용자별 AI 사용 횟수 제한

2026-09-29 작성. 브랜치 `feat/ai-quota`(가계부 저장 브랜치 `feat/supabase-ledger` 위에서 시작).

## 목적

AI 일정 짜기·챗봇·영수증 인식은 모두 Gemini `gemini-3.5-flash-lite` 무료 등급을 쓰며, **앱 전체가 하루 500회를 나눠 쓴다.** 지금은 사용자별 제한이 없어 한 사람이 몰아 쓰면 나머지가 못 쓴다. 사용자마다 하루 횟수를 서버에서 세어 넘으면 막고, 앱 전체 무료 한도가 바닥난 경우와 구분해 알린다.

## 사용자 결정 (2026-09-29)

| 질문 | 결정 |
| --- | --- |
| 한도 숫자 | 에이전트에게 맡김 → 아래 표 |
| 한도 방식 | 기능별 하루 한도(통합 한도·앱에서만 세기 대신) |
| 오류 | 내 한도 초과와 앱 전체 무료 한도 소진을 따로 알린다 |

## 1. 한도

| 기능 | 종류 키 | 하루 한도 | 근거 |
| --- | --- | --- | --- |
| AI 일정 짜기 | `plan` | 5 | 여행마다 몇 번 쓰는 기능 |
| 챗봇 | `chat` | 30 | 메시지마다 한 번 호출 |
| 영수증 인식 | `receipt` | 10 | 사진 한 장당 한 번 |

- 한 사람이 모두 써도 45회라 10명이 한도까지 써도 500회 안에 든다.
- 날짜는 **한국 시간(Asia/Seoul) 0시**에 바뀐다. 사용자가 이해하기 쉬운 경계다. Gemini 무료 한도는 태평양 자정(한국 오후 4~5시)에 초기화되므로 두 안내의 시각이 다르다.
- 기본값은 서버 함수 코드의 상수다. 특정 사용자의 한도는 `ai_quota_overrides` 행으로 바꾼다(관리자가 SQL로 넣는다. 관리 화면은 만들지 않는다).

## 2. 데이터베이스

마이그레이션 `20260929000004_ai_usage.sql`.

```text
ai_usage            (user_id uuid → auth.users on delete cascade, day date, kind text,
                     count int ≥ 0, primary key (user_id, day, kind))
ai_quota_overrides  (user_id uuid → auth.users on delete cascade, kind text,
                     daily_limit int ≥ 0, primary key (user_id, kind))
```

- `kind`는 `plan`·`chat`·`receipt`만 허용한다(check).
- 두 표 모두 RLS를 켜고 `authenticated`·`anon`에 권한을 주지 않는다. 사용자는 자기 횟수를 읽지도 고치지도 못한다. 남은 횟수는 서버 함수 응답으로만 안다.

### 함수

`consume_ai_quota(p_user uuid, p_kind text, p_default_limit int) returns int`

- 오늘(한국 시간) 행을 원자적으로 1 올리고 **남은 횟수**를 돌려준다. 한도는 `ai_quota_overrides`에 행이 있으면 그 값, 없으면 `p_default_limit`.
- 이미 한도에 닿았으면 올리지 않고 `P0429`(`user_limit`)로 거절한다.
- 동시 요청: `insert … on conflict do update set count = count + 1 where count < limit` 한 문장으로 처리해, 둘이 동시에 마지막 한 번을 써도 한도를 넘지 않는다.

`refund_ai_quota(p_user uuid, p_kind text) returns void`

- 오늘 행을 1 내린다(0 아래로는 내리지 않는다). 모델 호출이 실패했을 때 쓴다.

두 함수 모두 `security definer`, `search_path = ''`, 실행 권한은 `service_role`에만 준다. 서버 함수는 이미 service role 키로 만든 관리 클라이언트를 갖고 있다(`getUser`에 쓰는 것).

## 3. 서버 함수 (ai-plan · ai-chat · receipt-scan)

세 handler의 의존성에 두 가지를 더한다.

```ts
consumeQuota(userId: string): Promise<number>; // 남은 횟수. 한도 초과면 'user_limit' 오류를 던진다
refundQuota(userId: string): Promise<void>;
```

흐름: 인증 → 입력 검증 → `consumeQuota` → 모델 호출 → 성공이면 `{ …기존 본문, remaining }`.

| 상황 | 응답 | 차감 |
| --- | --- | --- |
| 입력이 잘못됨 | 400 `invalid_request` | 하지 않음(검증이 먼저) |
| 내 한도 초과 | 429 `user_limit`, `limit` 포함 | 하지 않음 |
| Gemini 429(앱 전체 무료 한도) | 429 `quota_exceeded` | 되돌림 |
| 그 밖의 모델 실패·시간 초과 | 기존 오류(500 등) | 되돌림 |
| 되돌리기 자체가 실패 | 원래 오류를 그대로 응답 | 한 번이 남는다(허용) |

- 기본 한도는 각 함수 `index.ts`의 상수로 두고 환경변수(`AI_LIMIT_PLAN` 등)가 있으면 덮는다. 코드 수정 없이 조정하기 위해서다.
- 챗봇에서 AI를 부르지 않는 로컬 명령·정해진 답은 서버에 오지 않으므로 세지 않는다.

## 4. 앱

- 세 제공자(`edge-ai-provider`, `edge-chat-provider`, `edge-receipt-scanner`)가 `user_limit`을 새 오류 종류로 받는다.
  - 내 한도: "오늘 AI 일정 만들기를 5번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요." (기능 이름·한도는 응답의 `limit`과 종류로 채운다)
  - 앱 전체 한도(`quota_exceeded`) 문구를 바꾼다: "오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요."
- 성공 응답의 `remaining`이 3 이하이면 그 기능 근처에 "오늘 N번 남음"을 작은 보조 글자로 보인다(일정 짜기 생성 버튼 아래, 챗봇 입력창 위 안내 줄, 영수증 인식 버튼 아래). 4 이상이면 보이지 않는다.
- 테스트 앱의 가짜 제공자(`Fixture…`)는 한도를 흉내 내지 않는다. 오류 문구는 제공자 단위 테스트로 확인한다.

## 5. 범위 밖

- 관리 화면(한도 조회·변경), 사용량 통계.
- 유료 전환·과금.
- 로그인하지 않은 사용자: 세 함수 모두 이미 로그인을 요구한다.

## 6. 검증

- 로컬 PostgreSQL(`supabase/tests/ai-usage.local.sql`): 차감·남은 횟수, 한도에서 거절, 예외 한도 적용, 되돌리기가 0 아래로 내려가지 않음, 사용자·종류·날짜별 분리, `authenticated`는 표와 함수 모두 거절.
- handler 단위 테스트(앱 vitest의 기존 `*-handler.spec.ts` 세 개): 한도 초과면 모델을 부르지 않고 429 `user_limit`, 성공 응답에 `remaining`, 모델 실패·Gemini 429에서 되돌림, 입력 오류는 차감하지 않음.
- 제공자 단위 테스트: `user_limit`·`quota_exceeded` 문구.
- 원격: 마이그레이션 적용과 세 함수 배포는 사용자 확인 뒤. 적용 후 비로그인·로그인 사용자가 두 표와 두 함수에 접근하지 못하는지(42501) 확인한다. 실제 한도 도달은 사용자 계정으로 확인한다.

## 문서 갱신

`docs/AI-PLANNING.md`(무료 한도 절: 사용자별 한도와 되돌리기), `docs/architecture/DATABASE.md`(두 표와 함수), `docs/기획안-v0.1.md` 새 절, OpenSpec `tasks.md`(3.27에 적힌 '사용자별 제한 필요'를 완료로).
