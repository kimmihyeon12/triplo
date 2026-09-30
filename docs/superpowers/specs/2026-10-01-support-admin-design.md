# 공지·문의 서버 저장과 관리자 관리 화면 설계 (2026-10-01)

- 상태: 설계 대화 합의(2026-10-01), 문서 검토 대기. 구현 전.
- 브랜치: `feat/support-admin`
- 선행 작업: [관리자 권한과 빈 관리자 화면](2026-09-29-admin-access-design.md) — `profiles.role`·`is_admin()`·`/admin` 진입 화면(v0.10.2 배포, 운영 적용·관리자 1명 부여 완료)
- 정책 원본: [기획안 36절](../../기획안-v0.1.md) "공지사항"·"문의하기"·"관리자 화면"·"표 구조"

## 1. 목적과 범위

지금 공지는 표본을 보여 주고, 문의는 기기에만 저장되어 운영자에게 가지 않는다. 공지와 문의를 서버에 저장하고, 관리자가 `/admin`에서 공지를 쓰고 발행하며 문의에 답하게 한다.

| 포함 | 제외(후속) |
| --- | --- |
| `notices`·`notice_reads`·`inquiries`·`inquiry_replies` 표와 서버 함수 | 배포할 때 AI가 공지 초안을 만드는 기능(2026-10-01 사용자 결정으로 제외, 표에 칸만 둔다) |
| 사용자 화면(공지사항·문의 목록·문의 보내기)의 서버 저장 전환 | 푸시·메일 알림(앱 안 개수 표시만 둔다) |
| 관리자 공지 관리(목록·작성·수정·발행·발행 취소·삭제) | 사용자의 추가 답글, 첨부 파일 |
| 관리자 문의 관리(목록·상태 필터·상세·답변·상태 변경) | 기기에 저장된 옛 문의의 서버 이전(2026-10-01 사용자 결정: 옮기지 않고 지운다) |

## 2. 방식

쓰기는 모두 `security definer` 서버 함수로만 하고 표에 직접 쓰는 권한은 주지 않는다. 읽기는 RLS가 걸린 표에서 직접 한다. 여행·가계부와 같은 방식이다. 상태 전환(답변하면 답변 완료)과 길이 검사를 서버 한 곳에서 지키고, 사용자가 자기 문의의 상태를 바꾸는 식의 우회를 권한에서 막는다.

비교한 다른 방식:
- 표 직접 읽기·쓰기(RLS만): 코드는 적지만 상태 규칙을 앱이 지켜야 하고, 우회를 정책마다 막아야 한다.
- Edge Function: 이 범위에는 과하다.

## 3. 서버 (마이그레이션 1개)

파일: `supabase/migrations/20261001000000_support.sql`. 운영에 적용된 최신 번호(`20260930000002`) 뒤다.

### 표

`notice_status` enum: `draft`, `published`.

`notices`
- `id uuid pk default gen_random_uuid()`, `title text` 1~100자, `body text` 1~5000자, `status notice_status not null default 'draft'`
- `generated boolean not null default false`, `release_tag text not null default ''` — 자동 공지용 칸. 이번에는 쓰지 않는다.
- `created_at`, `updated_at`, `published_at timestamptz null`
- RLS 읽기: `status = 'published'`이면 로그인 사용자 모두, 아니면 `is_admin()`만.

`notice_reads`
- `(user_id uuid references auth.users on delete cascade, notice_id uuid references notices on delete cascade, read_at timestamptz)` 기본 키 `(user_id, notice_id)`
- RLS 읽기: 본인 행만.

`inquiry_kind` enum: `bug`, `idea`, `account`, `etc`. `inquiry_status` enum: `open`, `reading`, `answered`.

`inquiries`
- `id uuid pk`, `user_id uuid not null references auth.users on delete cascade`, `sender_nickname text not null default ''`, `kind inquiry_kind`, `body text` 1~1000자, `status inquiry_status not null default 'open'`
- `app_version text` 최대 40자, `user_agent text` 최대 300자, `created_at`, `updated_at`
- `answer_read_at timestamptz null` — 사용자가 답변을 확인한 시각. 이보다 나중 답변이 있으면 "새 답변"이다.
- RLS 읽기: `user_id = auth.uid()` 또는 `is_admin()`.

`inquiry_replies`
- `id uuid pk`, `inquiry_id uuid references inquiries on delete cascade`, `author_role app_role not null`, `body text` 1~2000자, `created_at`
- 이번 범위에서는 관리자만 답변한다. 작성자 칸은 사용자 답글을 후속으로 열 때 쓴다.
- RLS 읽기: 그 문의를 읽을 수 있는 사람(본인 또는 관리자).

권한: 네 표 모두 `anon`에서 모든 권한을 거두고, `authenticated`에는 `select`만 준다. `insert`·`update`·`delete` 정책과 권한은 두지 않는다.

### 서버 함수 (`security definer`, `set search_path = ''`, 실행 권한은 `authenticated`만)

사용자:
- `send_inquiry(p_kind, p_body, p_app_version, p_user_agent) returns uuid` — 본문을 다듬어 길이를 검사한다. 보낸 사람 닉네임은 서버가 `auth.users.raw_user_meta_data ->> 'travel_nickname'`에서 읽어 넣는다(앱이 보낸 값을 믿지 않는다).
- `mark_inquiry_read(p_id)` — 본인 문의의 `answer_read_at`을 지금으로 한다. 남의 문의면 `P0404`.
- `mark_notices_read()` — 지금 발행된 공지 중 안 읽은 것을 모두 읽음으로 기록한다.

관리자(안에서 `is_admin()`이 아니면 `42501`):
- `admin_save_notice(p_id uuid null, p_title, p_body) returns uuid` — `p_id`가 없으면 초안을 만들고, 있으면 제목·본문을 고친다(발행 상태는 그대로).
- `admin_set_notice_published(p_id, p_published boolean)` — 발행하면 `published_at`을 지금으로, 취소하면 초안으로 돌리고 `published_at`을 비운다.
- `admin_delete_notice(p_id)`
- `admin_reply_inquiry(p_id, p_body) returns uuid` — 답변을 더하고 상태를 `answered`로 한다. 사용자에게는 `answer_read_at`보다 나중 답변이라 새 답변으로 보인다.
- `admin_set_inquiry_status(p_id, p_status)` — 확인 중·접수됨으로 되돌리는 데 쓴다.

오류 코드: 길이·값 오류 `P0400`, 없는 대상 `P0404`, 권한 없음 `42501`.

## 4. 앱

### 사용자 쪽 (`features/support/`)

- `SupabaseSupportRepository`를 `SupportRepository` 인터페이스 그대로 만든다. `delivers = true`라 "기기에만 남아요" 안내가 사라진다.
  - `notices()`: 발행 공지를 최신 발행순으로 읽는다.
  - `unreadNoticeCount()`·`unreadNoticeIds()`: 발행 공지 id와 내 `notice_reads`를 비교한다.
  - `inquiries()`: 내 문의와 답변을 함께 읽어 모델 `Inquiry`로 바꾼다(`readAt` ← `answer_read_at`).
  - `unansweredReadCount()`: 답변이 있고 마지막 답변이 `answer_read_at`보다 나중인 문의 수.
- 데이터 접근은 여행·가계부처럼 작은 데이터 클라이언트(`supabaseSupportDataClient(() => auth.dataClient())`)로 감싸 단위 테스트에서 가짜로 바꾼다.
- `app.config.ts`: 실행 앱은 서버 구현, 테스트 앱·디자인 미리보기는 지금의 기기 구현을 쓴다. 실행 앱으로 바꿀 때 계정별 기기 문의 열쇠(`accountKey('support')` 접두어)를 지우는 정리 함수를 둔다(옮기지 않는다).

### 관리자 쪽 (`features/admin/`)

- `data/admin-support.ts`: 관리자 함수 호출과 관리자 읽기(초안 포함 공지 목록, 전체 문의와 답변)를 담는다. 오류 코드를 사용자 문장으로 바꾼다.
- 라우트(모두 `requireAdmin`):
  - `/admin/notices` 공지 목록: 초안·발행 배지, 발행일, "새 공지".
  - `/admin/notices/new`, `/admin/notices/:id` 공지 폼: 제목·본문, 저장, 발행/발행 취소, 삭제(확인 단계).
  - `/admin/inquiries` 문의 목록: 상태 필터(전체·접수됨·확인 중·답변 완료), 종류·닉네임·날짜·본문 앞부분, 접수됨 개수.
  - `/admin/inquiries/:id` 문의 상세: 종류·본문·앱 버전·기기·보낸 사람 닉네임·보낸 시각, 답변 기록, 답변 입력, 상태 변경.
- `admin-home`의 "준비 중" 두 줄을 이 화면으로 가는 링크로 바꾼다.
- 디자인은 `docs/design/DESIGN.md` 토큰과 내 정보·공지사항 목록의 줄 모양을 따른다.

### 화면 가드의 한계

가드는 길을 가리는 편의다. 초안 공지와 남의 문의는 RLS가, 관리자 쓰기는 함수 안의 `is_admin()`이 막는다.

## 5. 오류 처리

| 상황 | 동작 |
| --- | --- |
| 네트워크·서버 오류로 공지·문의를 못 읽음 | 사용자 화면은 지금처럼 오류 안내를 보이고 입력은 남긴다 |
| 문의 보내기 실패 | 입력을 남기고 오류 토스트. 다시 보낼 수 있다 |
| 관리자 함수 `42501` | "관리자 권한이 없어요" 안내 후 `/account`로 |
| 길이 오류 `P0400` | 저장 버튼을 미리 잠그고, 서버 거절 시 안내 |
| 이미 지워진 공지·문의 `P0404` | 목록으로 돌아가며 안내 |

## 6. 검증

- 서버: `supabase/tests/support.local.sql`로 로컬 PostgreSQL 17 임시 DB에서 확인한다.
  - 일반 사용자: 초안 공지·남의 문의·남의 답변을 읽지 못한다. 표에 직접 쓰지 못한다. 관리자 함수는 `42501`.
  - 로그인하지 않은 사용자: 표·함수 모두 거절.
  - 관리자: 초안 작성·발행·취소·삭제, 답변하면 상태가 답변 완료가 되고 사용자에게 새 답변으로 세어진다.
  - 닉네임은 서버가 채운다.
- 앱: 서버 저장소의 변환·개수 계산, 관리자 데이터 계층, 폼 검증 단위 테스트. e2e(데스크톱·360px)는 서버 응답을 흉내 내 관리자 공지 작성·발행, 문의 답변, 일반 사용자의 `/admin/*` 차단을 확인한다.
- `npm run lint`, 전체 단위 테스트, 운영 빌드.
- 운영: 사용자 확인 후 마이그레이션을 적용하고, 실제 관리자 계정으로 공지 발행과 문의·답변을 한 번씩 해 본다. 그전까지는 미검증으로 보고한다.

## 7. 문서 갱신

기획안 36절(구현 범위·자동 공지 제외·기기 문의 삭제), `docs/architecture/DATABASE.md`(표·함수·권한), `docs/DEVELOPMENT.md`(고객 지원 행), OpenSpec `plan-travel-companion-mvp/tasks.md` 14.8·14.9, `docs/README.md` 목차.
