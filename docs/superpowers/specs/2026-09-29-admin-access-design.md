# 관리자 권한과 빈 관리자 화면 설계 (2026-09-29)

이 문서는 관리자 판별과 `/admin` 진입 화면의 설계 결정을 기록한다. 관리자 화면의 정책은 [기획안 36절](../../기획안-v0.1.md), 작업 항목은 [OpenSpec 작업 현황](../../../openspec/changes/plan-travel-companion-mvp/tasks.md) 14.8·14.9에 있다. 이 문서는 구현 완료를 뜻하지 않는다.

## 1. 목적과 범위

사용자가 지정한 관리자 계정으로 로그인하면 내 정보 화면에 관리자 메뉴가 보이고 `/admin`에 들어갈 수 있어야 한다. 다른 사용자에게는 메뉴가 보이지 않고, 주소를 직접 입력해도 막힌다.

이번 작업의 범위는 **권한과 빈 화면**이다(2026-09-29 사용자 결정).

| 포함 | 제외(후속) |
| --- | --- |
| `profiles` 표와 `role` 칸, 서버 판별 함수 `is_admin()` | `notices`·`notice_reads`·`inquiries`·`inquiry_replies` 표 |
| `/admin` 가드와 내 정보의 관리자 메뉴 | 공지 조회·수정·발행, 문의 조회·답변 |
| 공지 관리·문의 관리 두 항목을 "준비 중"으로 보여주는 진입 화면 | 기기 저장 공지·문의의 서버 이전, 배포 자동 공지 |

## 2. 기존 결정과의 관계

기획안 36절은 "관리자는 `profiles.role`로 가려내고, 서버 규칙에서도 같은 검사를 하며, 권한 부여는 화면이 아니라 Supabase에서 직접 한다"고 정했다. 이 설계는 그 결정을 그대로 따른다.

다만 기획안은 `profiles` 표가 이미 있다고 전제했으나 실제로는 없다. 닉네임은 Supabase Auth의 `user_metadata`에 저장된다. 따라서 이번 작업에서 `profiles`를 **역할 전용 표**로 새로 만든다. 닉네임을 표로 옮기는 일은 이번 범위가 아니다.

## 3. 권한 저장 방식

두 방식을 비교했다.

| 방식 | 장점 | 단점 |
| --- | --- | --- |
| **`profiles.role` + `is_admin()` (채택)** | 기획안과 일치한다. 권한을 바꾸면 다음 요청부터 반영된다. 후속 표의 RLS가 같은 함수를 쓴다 | 표와 함수가 하나씩 늘어난다 |
| Auth `app_metadata.role` | 표가 필요 없고 JWT에서 바로 읽는다 | 토큰이 갱신될 때까지 권한 변경이 반영되지 않는다. 기획안과 어긋난다 |

## 4. 서버

마이그레이션 `supabase/migrations/20260930000002_profiles_role.sql`을 추가한다. 가계부 작업(`feat/supabase-ledger`)이 `20260929000002`까지 사용하고 있으므로, 두 브랜치를 합칠 때 파일명이 겹치지 않도록 시각을 띄운다.

- `app_role` enum: `user`, `admin`.
- `profiles(id uuid primary key references auth.users(id) on delete cascade, role app_role not null default 'user', created_at timestamptz not null default now())`.
  - 행이 없으면 일반 사용자로 본다. 가입 시 행을 만드는 트리거는 두지 않는다. 역할 말고는 담을 값이 없기 때문이다.
  - 계정을 지우면 함께 지운다. delete-account 함수가 `auth.users`를 실제로 지우므로 cascade가 없으면 탈퇴가 실패한다.
- RLS: 본인 행 조회만 허용한다. insert·update·delete 정책은 두지 않는다. 사용자가 스스로 관리자가 될 수 없다.
- 권한: `authenticated`에 `select`만 준다. `anon`에는 주지 않는다.
- `public.is_admin() returns boolean`: `security definer`, `stable`, `set search_path = ''`. `auth.uid()`의 `profiles.role = 'admin'` 여부를 돌려준다. 실행 권한은 `public`에서 회수하고 `authenticated`에만 준다. 후속 공지·문의 표의 RLS가 이 함수를 호출한다.

### 관리자 부여

화면에서 부여하지 않는다. 관리자 이메일을 마이그레이션에 넣으면 저장소에 개인 정보가 남으므로, 원격 DB에서 아래 형식의 SQL을 한 번 직접 실행한다. 이메일은 문서에도 적지 않는다.

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = '<관리자 이메일>'
on conflict (id) do update set role = excluded.role;
```

대상 계정이 한 번 이상 로그인해 `auth.users`에 행이 있어야 한다. 원격 적용은 사용자 확인을 받은 뒤에 한다.

## 5. 앱

### 서버 호출

`AuthStore`가 Supabase 클라이언트를 소유하고 있으므로, 기존 `callFunction`과 같은 형태로 `callRpc<T>(name)`를 추가한다. 클라이언트가 없으면 `server_unavailable`을 던진다.

### `features/admin/`

- `data/admin-access.ts` (`providedIn: 'root'`): `check(): Promise<boolean>`가 `callRpc('is_admin')`를 호출해 결과를 `isAdmin` signal에 담는다. 결과는 사용자 ID별로 한 번만 조회한다. 로그아웃하거나 사용자가 바뀌면 값을 버린다. 호출이 실패하면 `false`로 본다.
- `admin.routes.ts`: `ADMIN_ROUTES`와 가드 `requireAdmin`을 둔다. 가드는 기존 `checkAuthentication`을 먼저 통과시킨 다음 `check()` 결과가 `false`이면 `/account`로 돌려보낸다. 실패하면 막는 쪽이 기본이다.
- `feature/admin-home/`: 공통 상단바, "공지 관리"와 "문의 관리" 두 줄을 "준비 중" 표시와 함께 보여준다. 누를 수 없는 상태임을 시각적으로도 드러낸다. DESIGN.md 토큰과 내 정보 목록의 줄 생김새를 따른다.

### 연결

- `app.routes.ts`에 `{ path: 'admin', loadChildren: ADMIN_ROUTES }`를 추가한다. 로그인 가드는 `ADMIN_ROUTES` 안에서 건다.
- 내 정보 화면은 `AdminAccess.check()`를 호출하고, `true`일 때만 계정 묶음 위에 "관리자" 줄을 보여준다. 일반 사용자에게는 자리도 남기지 않는다.
- `AuthStore`의 로그아웃 이동 대상 경로 정규식에 `admin`을 추가한다.

### 화면 가드의 한계

화면 가드는 편의 기능이다. 실제 보호는 서버 RLS가 맡는다. 이번 범위의 관리자 화면에는 서버 데이터가 없으므로 가드를 우회해도 얻는 정보가 없다. 후속 공지·문의 표는 `is_admin()`으로 초안 공지와 남의 문의를 막는다.

## 6. 오류 처리

| 상황 | 동작 |
| --- | --- |
| Supabase 설정 없음·네트워크 실패 | 관리자가 아닌 것으로 본다. 메뉴를 숨기고 `/admin`은 `/account`로 보낸다 |
| 마이그레이션 미적용(`is_admin` 없음) | 위와 같다 |
| 관리자 권한 회수 | 다음 앱 실행 또는 계정 전환 때부터 메뉴가 사라진다 |

## 7. 검증

- 단위: `requireAdmin`(관리자 통과, 일반 사용자 차단, 조회 실패 시 차단), `AdminAccess`(사용자별 1회 조회, 사용자 변경 시 초기화).
- E2E(PC·360px): `rest/v1/rpc/is_admin` 응답을 흉내 내어 관리자에게만 내 정보 메뉴가 보이는지, 일반 사용자가 `/admin`을 입력하면 `/account`로 돌아가는지 확인한다.
- `npm run lint`, `npm test`, 운영 빌드.
- 실제 계정 확인은 원격 마이그레이션 적용과 관리자 부여 뒤에 한다. 그전까지는 미검증으로 보고한다.

## 8. 문서 갱신

기획안 36절, OpenSpec `tasks.md` 14.8(`profiles.role` 부분)·14.9(진입 화면 부분), `docs/architecture/DATABASE.md`, `docs/DEVELOPMENT.md`를 같은 작업에서 갱신한다.
