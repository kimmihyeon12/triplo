# 친구 초대와 함께 편집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초대 링크로 친구가 여행·가계부를 함께 편집하고, 여행·가계부 표의 직접 쓰기를 막는다.

**Architecture:** `trip_members`·`trip_invites` 표와 `is_trip_member` 기반 읽기 정책, 모든 쓰기를 `security definer` 함수로. 앱은 `Trip.sharing`, `TRIP_MEMBERS` 저장소(서버/기기), 초대·합류 화면을 더한다.

**Tech Stack:** PostgreSQL 17 plpgsql·pgcrypto(`extensions` 스키마), Angular 21 zoneless·signals, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-trip-members-design.md` — 표·함수·권한·화면의 세부 규칙은 명세가 원본이다. 이 계획은 순서·파일·검증을 정한다.

## Global Constraints

- 코드 글자: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 8자, 화면 표기 `ABCD-EFGH`, 7일 만료, 여행당 하나.
- 오류 코드: `28000` 로그인 필요, `P0404` 없음·권한 없음(초대는 `invite_invalid`), `P0409` 충돌, `P0422` 규칙 위반(주인 나가기·주인 빼기).
- 모든 새·바뀐 함수: `security definer`, `set search_path = ''`, 이름은 스키마까지 적는다.
- `authenticated`는 여행·가계부 표에 select만. 초대 미리보기만 `anon` 실행 허용.
- 커밋 규칙은 CLAUDE.md(`type(scope): 제목`, 한국어 본문, Co-Authored-By).
- 원격 적용·배포는 사용자 확인 뒤.

## Review Focus

1. **다른 여행의 id로 쓰기 함수 호출:** definer 함수가 RLS를 건너뛰므로 모든 함수가 멤버 확인을 해야 한다. → Task 1 SQL(비멤버의 save_trip·가계부 함수·delete_trip·초대 함수 거절).
2. **남의 개인 지출:** 읽기에서 보이지 않고, id를 알아도 고치거나 지울 수 없다. → Task 1 SQL.
3. **빠진 멤버:** 곧바로 읽기·쓰기 거절. → Task 1 SQL.
4. **초대 미리보기의 정보 누출:** 메모·예약·금액·주소·가계부 없음, 잘못된 코드와 만료가 같은 오류. → Task 1 SQL.
5. **로그인 뒤 돌아오기가 아무 주소로나 보내는 경우:** `/join/`으로 시작하는 경로만 허용. → Task 5 단위 테스트.

---

### Task 1: DB 표·정책·함수
- Create `supabase/migrations/20260929000005_trip_members.sql`, `supabase/tests/trip-members.local.sql`.
- [ ] 로컬 검사를 먼저 쓴다(Review Focus 1~4와 명세 4절의 항목 전부, 각 줄에 기대값 주석). 마이그레이션 없이 실행해 실패를 확인한다.
- [ ] 마이그레이션을 쓴다(명세 1절). 기존 `ledger.local.sql`·`save-trip.local.sql`도 새 마이그레이션을 포함해 다시 돌려 통과를 확인한다(주인 동작 회귀).
- [ ] 커밋 `feat(app): 여행 멤버·초대 표와 멤버 권한 함수를 추가한다`.

### Task 2: 여행 읽기·삭제와 sharing
- Modify `trips/model/trip.ts`(`TripSharing`), `trips/data/trip-rows.ts`(select에 `owner_id, trip_members(user_id, role, nickname)` → `sharing`, 현재 사용자 id로 role 계산), `trips/data/trip-data-client.ts`(삭제를 `delete_trip` RPC로), 관련 spec.
- [ ] 테스트: 행 변환이 주인/멤버 role과 멤버 목록을 만든다. 삭제는 `delete_trip`을 부른다.
- [ ] 커밋 `feat(app): 서버 여행에 멤버 정보를 싣고 삭제를 함수로 한다`.

### Task 3: 멤버 저장소
- Create `features/collaboration/data/trip-members-repository.ts`(`TRIP_MEMBERS` 토큰, 인터페이스: `createInvite(tripId): Promise<string>`, `revokeInvite(tripId)`, `inviteExpiry(tripId): Promise<string | null>`, `preview(code): Promise<InvitePreview>`, `join(code): Promise<string>`, `leave(tripId)`, `remove(tripId, userId)`), `supabase-trip-members.ts`, `local-trip-members.ts`, `invite-code.ts`(`normalizeCode`, `formatCode`), spec들. `app.config.ts`에서 테스트/미리보기는 기기, 실행은 서버.
- [ ] 테스트: 코드 정규화·표기, 서버 구현의 RPC 이름·인자·오류 변환(`invite_invalid` → 한 가지 문장), 기기 구현의 고정 코드.
- [ ] 커밋 `feat(app): 초대·합류·멤버 관리 저장소를 둔다`.

### Task 4: 초대 화면
- Modify `features/collaboration/feature/invite/*`: 주인·멤버 화면(명세 2절), 복사는 토스트. 미리보기 버튼 제거.
- [ ] e2e(테스트 앱, 기기 구현): 링크 만들기 → `TEST-CODE` 표시·복사 토스트 → 새로 만들기·취소.
- [ ] 커밋 `feat(app): 초대 화면에서 링크를 만들고 멤버를 관리한다`.

### Task 5: 합류 화면과 로그인 뒤 돌아오기
- Create `features/collaboration/feature/join/*`, 라우트 `/join/:code`(가드 없음). Create `features/auth/util/return-to.ts`(`rememberReturn(path)`, `takeReturn(): string | null` — `/join/`만 허용). `login.ts`·`onboarding.ts`가 로그인 뒤 `takeReturn()`을 먼저 본다.
- [ ] 단위: `takeReturn`은 `/join/ABCD2345`만 돌려주고 `https://…`·`/trips`·`//x`는 버린다.
- [ ] e2e: `/join/TEST-CODE`에서 미리보기와 [함께하기] → 여행 상세로 이동. 잘못된 코드 안내.
- [ ] 커밋 `feat(app): 초대 링크로 미리보고 함께하기로 합류한다`.

### Task 6: 목록·상세·가계부 표시
- 여행 목록 '함께' 라벨, 상세 머리글 멤버, 멤버의 [나가기](삭제 대신), 가계부 `self` 표시 이름(주인이 아니면 주인 닉네임).
- [ ] 단위: 표시 이름 함수. e2e 기존 흐름 회귀.
- [ ] 커밋 `feat(app): 함께 쓰는 여행을 목록·상세·가계부에 표시한다`.

### Task 7: 원격 적용·문서 (사용자 확인)
- [ ] 확인 뒤 `npx supabase db push --linked --yes`, 비로그인 검사(표 42501, 쓰기 함수 42501, 미리보기 잘못된 코드 `invite_invalid`).
- [ ] 문서(명세 '문서 갱신'). 커밋 `docs: 친구 초대와 함께 편집 적용을 적는다`.
