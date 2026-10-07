# 관리자 사용량·비용 화면 설계 (2026-10-07)

- 상태: 설계 대화 합의(2026-10-07, 사용자 "설계후 구현 ㄱ"). 구현 전.
- 선행: [관리자 권한 설계](2026-09-29-admin-access-design.md), AI 하루 한도(`20260929000004_ai_usage.sql`)

## 1. 목적과 범위

Gemini와 Supabase를 모두 무료 등급으로 쓴다. 지금 청구액은 0원이므로 관리자가 알아야 할 것은 두 가지다(사용자 결정: 둘 다).

1. 무료 한도에 얼마나 가까운지. 넘기 전에 안다.
2. 유료였다면 이번 달 얼마였을지. 유료 전환 시점을 판단한다.

| 포함 | 제외 |
| --- | --- |
| Gemini 실제 호출 기록 표 `ai_calls`와 90일 정리 | 사용자별 사용량 화면(하루 한도는 이미 `ai_usage`가 맡는다) |
| 관리자 전용 집계 함수 `admin_usage_summary()` | 전송량(egress)·서버 함수 호출 수(관리 API 토큰이 필요해 제외, 사용자 결정) |
| `/admin/usage` 화면과 관리자 홈 메뉴 | 한도 경고 알림 발송 |
| | GitHub에서 추적(2026-10-07 사용자가 관리자 페이지로 바꿈) |

## 2. 왜 새 기록 표인가

- `ai_usage`는 사용자 요청 횟수만 센다. 실패한 호출을 돌려주며(`refund_ai_quota`) 토큰 수가 없다.
- Gemini 무료 한도(하루 500회)는 실제 요청 수로 센다. 실패한 요청도 센다.
- Gemini 무료 키에는 사용량 조회 API가 없다. 우리가 부를 때 직접 남겨야 한다.

비교한 방식: 기존 `ai_usage`만 쓰기(실제보다 적게 보임), Google Cloud 사용량 API(서비스 계정 키가 필요, 지금 규모에 과함).

## 3. 서버 (마이그레이션 1개, `20261007200000_admin_usage.sql`)

### 표 `ai_calls`

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `id` | `bigint generated always as identity` | 기본 키 |
| `at` | `timestamptz not null default now()` | 호출 시각 |
| `kind` | `text` check `plan`·`chat`·`receipt` | 기능 |
| `model` | `text not null` 1~100자 | 모델 이름 |
| `ok` | `boolean not null` | 모델이 200으로 답했는지 |
| `input_tokens` | `integer not null default 0` ≥ 0 | `usageMetadata.promptTokenCount` |
| `output_tokens` | `integer not null default 0` ≥ 0 | `candidatesTokenCount + thoughtsTokenCount`(생각 토큰도 출력 요금) |

사용자 id는 남기지 않는다. 집계에 필요 없다. 색인 `(at)`. RLS를 켜고 `anon`·`authenticated` 권한을 모두 거둔다. 서버 함수가 service_role로 넣는다.

pg_cron으로 매일 90일이 지난 줄을 지운다(알림 내역 정리와 같은 방식).

### 함수 `admin_usage_summary()` → jsonb

관리자가 아니면 `42501`. `authenticated`에만 실행 권한을 준다.

```json
{
  "measuredAt": "2026-10-07T06:00:00Z",
  "gemini": {
    "dayStart": "2026-10-07T07:00:00Z",
    "dayRequests": 42, "dayFailed": 1,
    "month": [{ "kind": "chat", "model": "gemini-3.5-flash-lite", "requests": 300, "inputTokens": 120000, "outputTokens": 80000 }]
  },
  "supabase": { "dbBytes": 31457280, "storageBytes": 0, "activeUsers30d": 12 }
}
```

- 하루: Gemini 무료 한도는 태평양 시간 0시에 초기화된다. `dayStart`는 `America/Los_Angeles` 기준 오늘 0시다. 화면에 초기화 시각을 한국 시간으로 보인다.
- 이번 달: 한국 시간 기준 이번 달 1일부터, 기능·모델별 합계.
- DB 크기 `pg_database_size(current_database())`, 파일 저장소 `storage.objects`의 `metadata->>'size'` 합, 최근 30일 로그인 사용자 `auth.users.last_sign_in_at`.

## 4. 서버 함수 기록

`supabase/functions/_shared/usage.ts`

- `tokenUsage(body)`: Gemini 응답 본문에서 입력·출력 토큰을 읽는다. 값이 없거나 이상하면 0.
- `callRecorder(client, kind, model)`: 한 번 호출 결과를 `ai_calls`에 넣는 함수를 돌려준다. 넣기에 실패해도 예외를 던지지 않는다. 기록 때문에 사용자 요청이 실패하면 안 된다.

`ai-plan`·`ai-chat`·`receipt-scan`의 `callModel`이 응답을 받은 뒤(성공·실패 모두), 그리고 네트워크 오류·시간 초과 때(`ok=false`, 토큰 0) 기록한다. 응답 형식은 바꾸지 않으므로 `ai-chat` 배포 순서 제약은 없다.

## 5. 앱

- `features/admin/model/usage.ts`
  - 무료 한도 상수: Gemini 하루 500회(2026-09-17 AI-PLANNING.md 기록 값. 구글이 모델·시기마다 바꾸므로 화면에 AI Studio 한도 화면 링크를 함께 둔다), DB 500MB, 파일 저장소 1GB, 월간 활성 사용자 5만 명([Supabase 요금](https://supabase.com/pricing), 2026-10-07 확인).
  - `usageLevel(used, limit)`: 80% 미만 `ok`, 80% 이상 `warn`, 100% 이상 `over`.
  - 단가표: `gemini-3.5-flash-lite` 입력 $0.30/100만 토큰, 출력 $2.50/100만 토큰([Gemini API 요금](https://ai.google.dev/gemini-api/docs/pricing), 2026-10-07 확인). 환율 1,355원(AI-PLANNING.md와 같은 값). 표에 없는 모델은 비용을 "단가 미등록"으로 보이고 합계에서 뺀다.
  - `estimateCost(month)`: 기능별·합계 원화 추정.
- `features/admin/data/admin-usage.ts`: `admin_usage_summary` 호출과 응답 검사. 형식이 깨졌으면 오류.
- `features/admin/feature/admin-usage`: `/admin/usage`.
  - Gemini: 오늘 호출 수/500 막대, 실패 수, 초기화 시각. 이번 달 기능별 호출·토큰·추정 비용, 합계.
  - Supabase: DB·파일 저장소·활성 사용자 막대.
  - 80% 이상은 경고색, 100% 이상은 위험색. 비율 숫자도 함께 적어 색에만 기대지 않는다.
  - "유료였다면"이라는 추정임을 밝히고 단가 확인 날짜를 적는다.
  - 전송량·서버 함수 호출은 Supabase 대시보드 사용량 화면 링크로 대신한다.
  - 관리자 권한이 사라졌으면 다른 관리자 화면처럼 내 정보로 보낸다.
- 관리자 홈에 "사용량" 메뉴를 더한다.

## 5-1. 후속 (2026-10-07 같은 날)

- 하루 기준이 한국 오후 4시에 바뀌면 오늘 호출이 0회로 돌아가 사라진 것처럼 보였다(사용자 지적). 집계에 `last24hRequests`를 더하고 막대 아래에 "최근 24시간 N회"를 보인다(`20261007400000`).
- 사용자 수별 예상 월 비용(사용자 요청): 이번 달 기록을 한 달로 늘려 최근 30일 활성 사용자 1명당 Gemini 비용을 구하고, 10·100·1,000·10,000명일 때 Gemini 비용, Supabase Pro($25 정액)를 더한 비용, 그때 1명당 비용을 표로 보인다. 활성 사용자나 기록이 없으면 표 대신 "기록이 쌓이면 보여요"라고 적는다.

## 6. 검증

- 로컬 SQL(`supabase/tests/admin-usage.local.sql`): 관리자 아니면 거절, 비로그인 거절, 하루·이번 달 집계, 지난달 기록 제외, 일반 사용자는 `ai_calls`를 읽지 못함.
- 단위 테스트: `tokenUsage`, `callRecorder`가 실패를 삼키는지, 세 함수가 기록을 부르는지는 핸들러가 아닌 `index.ts`라 단위 테스트 대신 배포 후 실제 호출로 확인한다. `usageLevel`, `estimateCost`, 응답 검사.
- e2e(`e2e/admin.spec.ts`): 응답을 가로채 화면 표시·경고색·모바일 가로 넘침 없음.
- 운영: 마이그레이션 적용, 세 함수 재배포 후 챗봇을 한 번 써서 `ai_calls`에 줄이 생기고 화면 숫자가 오르는지 확인.

관리자 전용 화면이라 앱 사용법(`guide.ts`)은 바꾸지 않는다.
