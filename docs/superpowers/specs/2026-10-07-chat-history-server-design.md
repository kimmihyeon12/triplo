# 채팅 기록 서버 저장 설계 (2026-10-07)

- 상태: 설계 대화 합의(2026-10-07), 문서 검토 대기. 구현 전.
- 선행: [챗봇 설계](2026-09-17-travel-chat-design.md), 여행 멤버 표(`20260929000005_trip_members.sql`)
- 정책 원본: 기획안 35절(대화형 여행 탐색). 이 설계로 "대화는 기기에만 저장" 결정을 바꾼다.

## 1. 목적과 범위

지금 AI 대화는 기기의 localStorage에만 계정별로 남는다(`LocalChatHistory`). 다른 기기에서 같은 계정으로 열면 대화가 없고, 브라우저 저장소를 비우면 사라진다. 대화를 서버에 저장해 기기를 바꿔도 이어서 보게 한다.

| 포함 | 제외 |
| --- | --- |
| `chat_messages` 표와 서버 함수(남기기·옮기기·지우기) | 여행 멤버끼리 대화 공유(2026-10-07 사용자 결정: 나만 보기) |
| 운영 빌드의 대화 저장소를 서버 구현으로 교체 | 대화 검색, 관리자 열람 |
| 기기에 남은 대화를 처음 한 번 서버로 옮기기(사용자 결정 A) | 실시간 동기화(다른 기기에서 쓴 말은 대화를 다시 열 때 보인다) |
| 개인정보 처리방침·사용법 문장 갱신 | |

## 2. 사용자 결정

- 같은 여행이라도 대화는 본인만 본다.
- 기기 기록은 서버로 옮기고 기기 사본은 지운다. 서버에 이미 같은 대화가 있으면 서버 쪽을 남긴다.
  - 2026-10-07 최종 검토 후 수정: 대화를 통째로 건너뛰지 않고 메시지 id로 합친다. 건너뛰면 첫 옮기기가 실패한 사이 새로 쓴 줄 때문에 다음 옮기기에서 옛 기록이 버려진다. 같은 줄은 한 번만 들어가 중복은 생기지 않는다.

## 3. 방식

메시지 한 줄을 행 하나로 저장하고, 앱은 새 메시지 한 줄만 올린다. 메시지는 만든 뒤 고치지 않고 뒤에 붙기만 한다(`TravelChatStore.push`). 두 기기에서 같은 대화에 써도 서로 덮어쓰지 않는다.

비교한 다른 방식:
- 대화 하나를 jsonb 한 행으로 통째로 저장: 단순하지만 매번 전체를 보내고, 두 기기가 쓰면 나중 쓴 쪽이 앞 내용을 지운다.

쓰기는 `security definer` 함수로만 하고 읽기는 RLS가 걸린 표에서 직접 한다. 여행·문의와 같은 규칙이다.

## 4. 서버 (마이그레이션 1개)

파일: `supabase/migrations/20261007100000_chat_messages.sql`.

### 표 `chat_messages`

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `user_id` | `uuid not null` → `auth.users(id) on delete cascade` | 대화 주인 |
| `id` | `text not null` | 앱이 만든 메시지 id. 기본 키는 `(user_id, id)` |
| `trip_id` | `text null` → `trips(id) on delete cascade` | 여행 상세에서 연 대화. 여행 목록에서 연 대화는 null |
| `role` | `text` check `user`·`assistant`·`system` | |
| `kind` | `text null` | `ChatReplyKind` |
| `text` | `text not null` 0~4000자 | 본문 |
| `extra` | `jsonb not null default '{}'` 64KB 이하 | `reference`·`draft`·`chips`·`localLink`·`localLinkLabel`·`copyText` |
| `at` | `timestamptz not null` | 메시지 시각. 순서 기준 |
| `created_at` | `timestamptz not null default now()` | 서버 저장 시각 |

색인: `(user_id, trip_id, at)`.

RLS 읽기: `user_id = auth.uid()`. `authenticated`에는 `select`만 준다.

### 함수

| 함수 | 하는 일 |
| --- | --- |
| `append_chat_message(p_trip_id text, p_message jsonb)` | 한 줄을 남긴다. 여행 대화면 `is_trip_member(p_trip_id)`가 아니면 `42501`. 길이·크기를 넘으면 `P0400`. 같은 id가 이미 있으면 무시한다(재시도 안전). 남긴 뒤 그 대화의 최근 200줄 밖은 지운다 |
| `import_chat_threads(p_threads jsonb)` → 옮긴 줄 수 | 기기 기록 옮기기. `{"<tripId 또는 __list__>": [메시지...]}`를 받는다. 서버 대화에 메시지 id로 합친다(이미 있는 줄은 건너뜀). 여행 멤버가 아니거나 여행이 없으면 그 대화는 건너뛰고, 깨진 줄은 그 줄만 버린다. 대화마다 최근 200줄만 넣고 합친 뒤 200줄로 자른다. 전체 2MB를 넘으면 `P0400` |
| `clear_chat(p_trip_id text)` | 그 대화의 본인 줄을 모두 지운다 |

세 함수 모두 로그인하지 않았으면 `42501`. `public`·`anon`의 실행 권한은 회수하고 `authenticated`에만 준다.

여행에서 나가도 그 여행의 본인 대화는 남는다. 다시 합류하면 이어 보이며, 여행이 지워지면 함께 지워진다.

## 5. 앱

- `ChatHistoryStore` 인터페이스의 `save(tripId, messages)`를 `append(tripId, message)`로 바꾼다. 화면 상태가 원본이고 저장소는 새 줄만 받는다. `LocalChatHistory`(테스트 빌드)도 같은 인터페이스로 고친다.
- `SupabaseChatHistory`(새 파일 `data/supabase-chat-history.ts`)
  - `load`: `chat_messages`에서 그 대화를 `at` 순서로 최근 200줄 읽어 `ChatMessage`로 바꾼다. 형식이 깨진 줄은 버린다.
  - `append`: `append_chat_message` 호출.
  - `clear`: `clear_chat` 호출.
- 실패 처리: 저장 실패는 대화를 막지 않는다. 화면 대화는 그대로 이어지고, 실패한 줄은 이 기기의 서버 기록에서 빠진다. 불러오기 실패는 빈 대화로 열고 오류를 띄우지 않는다.
- 기기 기록 옮기기: 로그인 상태가 확인되면 한 번, 그 계정의 기기 기록 키(`accountKey('chat')`)가 있으면 `import_chat_threads`로 대화별로 올린다. 한 번에 1.5MB를 넘지 않게 나눠 보내고, 부가 정보가 64KB를 넘는 줄은 서버가 받지 않으므로 뺀다. 성공한 대화만 기기에서 지우고, 실패한 대화는 남겨 다음 실행에서 다시 옮긴다. 기기 저장소를 읽을 수 없으면 옮기기 없이 서버 저장을 쓴다. 대화를 열 때(`open`)는 옮기기가 끝난 뒤에 읽는다.
- `app.config.ts`: 운영·개발 빌드는 `SupabaseChatHistory`, 테스트 빌드(`environment.isTest`)는 `LocalChatHistory`.

## 6. 문서·화면 문장

- 개인정보 처리방침(`features/support/model/policy.ts`): "AI 챗봇과 나눈 대화는 서버에 저장하며 본인만 볼 수 있습니다. 대화 지우기나 탈퇴로 지울 수 있습니다." 이미 서버에 저장 중인 문의를 "기기에만 저장"으로 적은 낡은 문장도 함께 고친다.
- 앱 사용법(`features/guide/model/guide.ts`) 채팅 장: 다른 기기에서도 이어진다는 설명.
- 기획안 35절·OpenSpec·`docs/architecture/DATABASE.md`·`ARCHITECTURE.md`의 저장 위치 설명.

## 7. 검증

- 로컬 SQL(`supabase/tests/chat-messages.local.sql`): 남기기·같은 id 무시·200줄 자르기·다른 사람 대화 안 보임·여행 멤버 아니면 거절·옮기기 건너뛰기 규칙·지우기·여행 삭제와 탈퇴 연쇄 삭제·비로그인 거절.
- 단위 테스트: `SupabaseChatHistory` 변환과 호출 인자, 옮기기 성공·실패 시 기기 키 처리, `TravelChatStore`가 새 줄만 `append`하는지.
- e2e: 테스트 빌드의 기존 대화 e2e가 그대로 통과하는지(저장소 인터페이스 변경 확인).
- 운영 확인: 원격 마이그레이션 적용 후 두 기기(또는 두 브라우저)에서 같은 계정으로 대화가 이어지는지. 원격 적용과 배포는 사용자 확인 후 진행한다.
