# 관리자 권한과 빈 관리자 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `profiles.role`이 `admin`인 계정만 내 정보 화면에서 관리자 메뉴를 보고 `/admin` 진입 화면에 들어갈 수 있게 한다.

**Architecture:** Supabase에 역할 전용 `profiles` 표와 `security definer` 함수 `is_admin()`을 둔다. 앱은 `AuthStore.callRpc('is_admin')`로 결과를 받아 `features/admin/data/admin-access.ts`가 사용자별로 보관하고, 라우트 가드와 내 정보 메뉴가 같은 값을 쓴다. 관리자 화면은 공지 관리·문의 관리를 "준비 중"으로 보여주는 진입 화면뿐이다.

**Tech Stack:** Angular 21(Zoneless, Signals, standalone), Tailwind, Supabase JS v2, PostgreSQL 17, Vitest(node 환경), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-access-design.md`

**작업 위치:** worktree `.claude/worktrees/feat-admin-access`, 브랜치 `feat/admin-access`. 기본 폴더(`feat/supabase-ledger`)에서는 다른 세션이 작업 중이므로 절대 `cd`하거나 git 명령을 보내지 않는다. 앱 명령은 `app/`에서 실행한다.

## Global Constraints

- 마이그레이션 파일명: `supabase/migrations/20260929100000_profiles_role.sql`.
- 관리자 이메일을 코드·마이그레이션·문서·커밋 메시지에 적지 않는다.
- `profiles`에는 insert·update·delete 정책을 두지 않는다. `authenticated`에는 `select`만, `anon`에는 아무 권한도 주지 않는다.
- `is_admin()`은 `security definer`, `stable`, `set search_path = ''`이며 실행 권한은 `authenticated`만 가진다.
- 조회가 실패하면 관리자가 아닌 것으로 본다(메뉴 숨김, `/admin` → `/account`).
- 컴포넌트는 폴더명과 파일명이 같고 HTML·TS를 분리하며 `-page` 접미사를 쓰지 않는다(`npm run lint`의 경계 검사).
- 다른 feature의 `/feature/` 파일을 직접 import하지 않는다. `data/`와 `*.routes.ts`는 import해도 된다.
- 커밋은 CLAUDE.md 규칙(`<type>(<scope>): <subject>`, 앱은 `app` scope)을 따르고 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`로 끝낸다.
- `npm run lint`는 기준 상태에서 `features/expenses/util/image.ts: browser dependency document in pure layer` 한 줄로 이미 실패한다. 이 줄 외에 새 오류가 없으면 통과로 본다.

## Review Focus

1. **로그아웃 후 다른 계정으로 로그인**: 앞 계정의 관리자 결과가 남아 메뉴가 보이면 안 된다. `isAdmin`은 현재 사용자 ID와 일치할 때만 참이다(Task 2 테스트).
2. **일시적 네트워크 실패 뒤 재시도**: 실패를 `false`로 캐시하면 새로고침 전까지 관리자가 들어갈 수 없다. 실패는 캐시하지 않는다(Task 2 테스트).
3. **`/admin` 동시 진입과 메뉴 표시가 같은 요청을 두 번 보냄**: 진행 중인 조회를 공유한다(Task 2 테스트).
4. **사용자가 직접 `profiles`에 자기 행을 넣거나 role을 바꾸려는 시도**: 서버가 거부해야 한다(Task 1 SQL 검증).
5. **로그인하지 않은 상태에서 `/admin` 입력**: 로그인 화면으로 가야 하며 `is_admin` 요청을 보내지 않는다(Task 3 단위 테스트).

---

### Task 1: profiles 표와 is_admin 함수

**Files:**
- Create: `supabase/migrations/20260929100000_profiles_role.sql`
- Test: 로컬 PostgreSQL 임시 DB (`C:\Program Files\PostgreSQL\17\bin\psql.exe`, 사용자 `postgres`, 비밀번호 `postgres`). 검증 스크립트는 scratchpad에 두고 커밋하지 않는다.

**Interfaces:**
- Produces: SQL 함수 `public.is_admin() returns boolean`. REST 경로는 `POST /rest/v1/rpc/is_admin`, 응답 본문은 JSON `true` 또는 `false`.

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 관리자 판별용 역할 표. 기획안 36절에 따라 관리자는 profiles.role로 가려낸다.
-- 닉네임은 아직 Auth user_metadata에 있으므로 이 표에는 역할만 둔다(2026-09-29).
-- 행이 없으면 일반 사용자다. 가입 때 행을 만드는 트리거는 두지 않는다.
--
-- 관리자 부여는 화면이 아니라 SQL로 직접 한다. 이메일을 이 파일에 적지 않는다.
-- 형식은 docs/architecture/DATABASE.md '관리자 부여'를 본다.

create type app_role as enum ('user', 'admin');

create table profiles (
  -- 계정을 지우면 함께 지운다. delete-account가 auth.users 행을 실제로 지우므로
  -- cascade가 없으면 외래 키 위반으로 탈퇴가 실패한다.
  id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- 본인 행만 읽는다. 쓰기 정책이 없으므로 사용자는 역할을 만들거나 바꿀 수 없다.
create policy profiles_select_own on profiles
  for select to authenticated
  using (id = (select auth.uid()));

grant select on public.profiles to authenticated;

-- 후속 공지·문의 표의 RLS가 같은 기준을 쓰도록 판별을 함수 하나에 둔다.
-- security definer라 RLS와 무관하게 profiles를 읽는다. search_path를 비워
-- 호출자가 만든 같은 이름의 객체로 바뀌지 않게 한다.
create function public.is_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
```

- [ ] **Step 2: 로컬 검증 스크립트 작성**

scratchpad에 `verify-profiles.sql`을 만든다. Supabase의 `auth` 스키마·역할을 최소한으로 흉내 낸 뒤 마이그레이션을 적용하고 동작을 확인한다.

```sql
\set ON_ERROR_STOP on
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

\i :migration

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'user@example.com');
insert into public.profiles (id, role)
  select id, 'admin' from auth.users where email = 'admin@example.com'
  on conflict (id) do update set role = excluded.role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select 'admin is_admin' as check, public.is_admin() as value;           -- t
select 'admin sees rows' as check, count(*) as value from public.profiles; -- 1
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'user is_admin' as check, public.is_admin() as value;            -- f
select 'user sees rows' as check, count(*) as value from public.profiles;  -- 0
\set ON_ERROR_STOP off
insert into public.profiles values ('00000000-0000-0000-0000-00000000000b', 'admin');  -- ERROR permission denied
update public.profiles set role = 'admin';                                             -- ERROR permission denied
reset role;
set role anon;
select public.is_admin();                                                              -- ERROR permission denied for function
reset role;
delete from auth.users where email = 'admin@example.com';
select 'cascade left' as check, count(*) as value from public.profiles;  -- 0
```

- [ ] **Step 3: 임시 DB에 적용해 확인**

Run (Bash, worktree 루트):

```bash
PSQL="/c/Program Files/PostgreSQL/17/bin/psql.exe"
export PGPASSWORD=postgres
"$PSQL" -U postgres -h localhost -c "drop database if exists tc_admin_verify" -c "create database tc_admin_verify"
"$PSQL" -U postgres -h localhost -d tc_admin_verify -v migration="$(pwd)/supabase/migrations/20260929100000_profiles_role.sql" -f "<scratchpad>/verify-profiles.sql"
"$PSQL" -U postgres -h localhost -c "drop database tc_admin_verify"
```

Expected: `admin is_admin | t`, `admin sees rows | 1`, `user is_admin | f`, `user sees rows | 0`, 이어서 `permission denied` 오류 3개, `cascade left | 0`. PostgreSQL 서비스가 꺼져 있으면 사용자에게 `net start postgresql-x64-17`(관리자 권한) 실행을 요청한다. 역할 `authenticated`·`anon`은 클러스터 전역이라 DB를 지워도 남지만 로그인 불가 역할이라 해가 없다.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260929100000_profiles_role.sql
git commit -m "feat: 관리자 판별용 profiles 표와 is_admin 함수를 둔다

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: AuthStore.callRpc와 AdminAccess

**Files:**
- Modify: `app/src/app/features/auth/data/auth-store.ts` (`callFunction` 바로 아래에 메서드 추가, 로그아웃 이동 정규식 수정)
- Create: `app/src/app/features/admin/data/admin-access.ts`
- Test: `app/src/app/features/admin/data/admin-access.spec.ts`

**Interfaces:**
- Consumes: `public.is_admin()` (Task 1).
- Produces:
  - `AuthStore.callRpc<T>(name: string): Promise<T>` — 클라이언트가 없으면 `Error('server_unavailable')`, 서버 오류면 `Error('rpc_failed')`.
  - `AdminAccess.check(): Promise<boolean>`
  - `AdminAccess.isAdmin: Signal<boolean>`

- [ ] **Step 1: 실패하는 테스트 작성**

`app/src/app/features/admin/data/admin-access.spec.ts`:

```ts
import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../auth/data/auth-store';
import { AdminAccess } from './admin-access';

function setup(rpc: () => Promise<unknown>) {
  const user = signal<{ id: string } | null>({ id: 'user-a' });
  const auth = {
    user,
    initialize: vi.fn(async () => undefined),
    callRpc: vi.fn(rpc),
  };
  const injector = Injector.create({
    providers: [{ provide: AuthStore, useValue: auth }, AdminAccess],
  });
  const access = runInInjectionContext(injector, () => injector.get(AdminAccess));
  return { access, auth, user };
}

describe('AdminAccess', () => {
  it('서버가 true를 주면 관리자다', async () => {
    const { access, auth } = setup(async () => true);
    expect(await access.check()).toBe(true);
    expect(access.isAdmin()).toBe(true);
    expect(auth.callRpc).toHaveBeenCalledWith('is_admin');
  });

  it('서버가 false를 주면 관리자가 아니다', async () => {
    const { access } = setup(async () => false);
    expect(await access.check()).toBe(false);
    expect(access.isAdmin()).toBe(false);
  });

  it('로그인하지 않았으면 서버에 묻지 않는다', async () => {
    const { access, auth, user } = setup(async () => true);
    user.set(null);
    expect(await access.check()).toBe(false);
    expect(auth.callRpc).not.toHaveBeenCalled();
  });

  it('같은 사용자는 한 번만 묻고, 동시에 불러도 요청을 공유한다', async () => {
    const { access, auth } = setup(async () => true);
    await Promise.all([access.check(), access.check()]);
    await access.check();
    expect(auth.callRpc).toHaveBeenCalledTimes(1);
  });

  it('사용자가 바뀌면 앞 사용자의 결과를 쓰지 않는다', async () => {
    const { access, auth, user } = setup(async () => true);
    await access.check();
    auth.callRpc.mockImplementation(async () => false);
    user.set({ id: 'user-b' });
    expect(access.isAdmin()).toBe(false);
    expect(await access.check()).toBe(false);
    expect(auth.callRpc).toHaveBeenCalledTimes(2);
  });

  it('조회가 실패하면 관리자가 아니고, 다음 확인 때 다시 묻는다', async () => {
    const { access, auth } = setup(async () => {
      throw new Error('rpc_failed');
    });
    expect(await access.check()).toBe(false);
    expect(access.isAdmin()).toBe(false);
    auth.callRpc.mockImplementation(async () => true);
    expect(await access.check()).toBe(true);
    expect(auth.callRpc).toHaveBeenCalledTimes(2);
  });

  it('true가 아닌 값은 관리자로 보지 않는다', async () => {
    const { access } = setup(async () => 'true');
    expect(await access.check()).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/admin/data/admin-access.spec.ts`
Expected: FAIL, `Cannot find module './admin-access'` 또는 이와 같은 해석 오류.

- [ ] **Step 3: AuthStore에 callRpc 추가**

`auth-store.ts`의 `callFunction` 메서드가 끝나는 `}` 바로 다음에 넣는다.

```ts
  /**
   * 인자 없는 데이터베이스 함수를 부른다. 로그인 토큰은 클라이언트가 실어 보낸다.
   * 서버 오류의 내용은 부르는 쪽이 구분할 필요가 없어 하나의 코드로 던진다.
   */
  async callRpc<T>(name: string): Promise<T> {
    if (!this.client) throw new Error('server_unavailable');
    const { data, error } = await this.client.rpc(name);
    if (error) throw new Error('rpc_failed');
    return data as T;
  }
```

같은 파일의 로그아웃 이동 정규식을 바꾼다.

```ts
          /^\/(trips|account|onboarding)(\/|\?|$)/.test(this.router.url)
```
→
```ts
          /^\/(trips|account|onboarding|admin)(\/|\?|$)/.test(this.router.url)
```

- [ ] **Step 4: AdminAccess 구현**

`app/src/app/features/admin/data/admin-access.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';

/**
 * 지금 로그인한 사람이 관리자인지 서버에 묻고 기억한다.
 *
 * 판별은 서버의 is_admin()이 한다. 화면이 이 값을 쓰는 것은 메뉴를 가리고
 * 길을 막는 편의일 뿐이며, 실제 데이터는 서버 규칙이 지킨다.
 *
 * 결과는 사용자 ID와 함께 둔다. 로그아웃 뒤 다른 계정으로 들어왔을 때
 * 앞 계정의 결과가 남아 메뉴가 보이면 안 된다. 실패는 기억하지 않는다.
 * 잠깐 끊긴 것 때문에 새로고침 전까지 관리자가 들어가지 못하면 안 된다.
 */
@Injectable({ providedIn: 'root' })
export class AdminAccess {
  private readonly auth = inject(AuthStore);
  private readonly known = signal<{ userId: string; admin: boolean } | null>(null);
  private pending: { userId: string; result: Promise<boolean> } | null = null;

  readonly isAdmin = computed(() => {
    const known = this.known();
    return !!known && known.admin && known.userId === this.auth.user()?.id;
  });

  async check(): Promise<boolean> {
    await this.auth.initialize();
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const known = this.known();
    if (known?.userId === userId) return known.admin;
    if (this.pending?.userId !== userId) {
      this.pending = { userId, result: this.ask(userId) };
    }
    return this.pending.result;
  }

  private async ask(userId: string): Promise<boolean> {
    try {
      const admin = (await this.auth.callRpc<unknown>('is_admin')) === true;
      this.known.set({ userId, admin });
      return admin;
    } catch {
      return false;
    } finally {
      if (this.pending?.userId === userId) this.pending = null;
    }
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd app && npx vitest run src/app/features/admin/data/admin-access.spec.ts`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/features/auth/data/auth-store.ts app/src/app/features/admin/data
git commit -m "feat(app): 관리자 여부를 서버에 묻고 사용자별로 기억한다

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: /admin 가드·진입 화면과 내 정보 메뉴

**Files:**
- Create: `app/src/app/features/admin/admin.routes.ts`
- Create: `app/src/app/features/admin/admin.routes.spec.ts`
- Create: `app/src/app/features/admin/feature/admin-home/admin-home.ts`
- Create: `app/src/app/features/admin/feature/admin-home/admin-home.html`
- Modify: `app/src/app/app.routes.ts` (`stats` 라우트 다음, `**` 앞)
- Modify: `app/src/app/shared/ui/icon/icon.ts` (`shield` 추가)
- Modify: `app/src/app/features/auth/feature/account/account.ts`
- Modify: `app/src/app/features/auth/feature/account/account.html` (설정 묶음과 계정 묶음 사이)
- Test: `app/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `AdminAccess.check()`, `AdminAccess.isAdmin` (Task 2), `checkAuthentication()` (`features/auth/auth.routes.ts`).
- Produces: `requireAdmin(): Promise<boolean | UrlTree>`, `ADMIN_ROUTES: Routes`, `AdminHome` 컴포넌트, 테스트 표시 `go-admin`·`admin-home`·`admin-notices`·`admin-inquiries`.

- [ ] **Step 1: 가드 단위 테스트 작성**

`app/src/app/features/admin/admin.routes.spec.ts`:

```ts
import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../auth/data/auth-store';
import { AdminAccess } from './data/admin-access';
import { requireAdmin } from './admin.routes';

function run(options: { user: { id: string } | null; admin: boolean }) {
  const check = vi.fn(async () => options.admin);
  const injector = Injector.create({
    providers: [
      {
        provide: AuthStore,
        useValue: {
          initialize: async () => undefined,
          user: signal(options.user),
          nickname: () => (options.user ? '여행테스터' : null),
        },
      },
      { provide: AdminAccess, useValue: { check } },
      { provide: Router, useValue: { createUrlTree: (commands: string[]) => ({ to: commands }) } },
    ],
  });
  return { result: runInInjectionContext(injector, () => requireAdmin()), check };
}

describe('requireAdmin', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', { getItem: () => null }));
  afterEach(() => vi.unstubAllGlobals());

  it('관리자는 들어간다', async () => {
    expect(await run({ user: { id: 'a' }, admin: true }).result).toBe(true);
  });

  it('일반 사용자는 내 정보로 돌아간다', async () => {
    expect(await run({ user: { id: 'b' }, admin: false }).result).toEqual({ to: ['/account'] });
  });

  it('로그인하지 않았으면 로그인 화면으로 가고 관리자 여부를 묻지 않는다', async () => {
    const { result, check } = run({ user: null, admin: true });
    expect(await result).toEqual({ to: ['/login'] });
    expect(check).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd app && npx vitest run src/app/features/admin/admin.routes.spec.ts`
Expected: FAIL, `./admin.routes` 해석 오류.

- [ ] **Step 3: 라우트와 가드 구현**

`app/src/app/features/admin/admin.routes.ts`:

```ts
import { inject } from '@angular/core';
import { Router, type Routes, type UrlTree } from '@angular/router';
import { checkAuthentication } from '../auth/auth.routes';
import { AdminAccess } from './data/admin-access';

/**
 * 관리자만 들인다. 로그인 확인을 먼저 하고, 통과한 경우에만 서버에 묻는다.
 * 확인하지 못하면 막는다. 이 가드는 길을 가리는 편의이며 데이터 보호는
 * 서버의 is_admin()과 RLS가 맡는다.
 */
export async function requireAdmin(): Promise<boolean | UrlTree> {
  // inject는 첫 await 전에 모두 불러야 한다. checkAuthentication도 안에서
  // 첫 await 전에 inject를 마친다.
  const router = inject(Router);
  const access = inject(AdminAccess);
  const signedIn = await checkAuthentication();
  if (signedIn !== true) return signedIn;
  return (await access.check()) ? true : router.createUrlTree(['/account']);
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAdmin],
    loadComponent: () => import('./feature/admin-home/admin-home').then((m) => m.AdminHome),
    title: '관리자',
  },
];
```

- [ ] **Step 4: 가드 테스트 통과 확인**

Run: `cd app && npx vitest run src/app/features/admin/admin.routes.spec.ts`
Expected: 3 passed. `AdminHome` 파일이 아직 없어도 동적 import라 node 테스트는 통과한다.

- [ ] **Step 5: shield 아이콘 추가**

`icon.ts`의 `lock:` 항목 바로 다음에 넣는다.

```ts
  // lucide: shield-check
  shield:
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4',
```

- [ ] **Step 6: 진입 화면 작성**

`app/src/app/features/admin/feature/admin-home/admin-home.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';

/**
 * 관리자 진입 화면.
 *
 * 공지·문의 관리는 서버 표가 생긴 뒤에 붙인다(OpenSpec 14.8·14.9). 지금은
 * 어떤 일이 이 자리에 올지 보여주고 누를 수 없게 둔다. 링크처럼 보이면
 * 눌러 보고 아무 일도 없어 헷갈린다.
 */
@Component({
  selector: 'app-admin-home',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-home.html',
})
export class AdminHome {
  constructor() {
    inject(PageBar).set({ title: '관리자', back: ['/account'], action: null });
  }
}
```

`app/src/app/features/admin/feature/admin-home/admin-home.html`:

```html
<div
  class="page mx-auto my-0 flex max-w-105 flex-col gap-3 p-[var(--sp-4)_var(--sp-4)_calc(var(--sp-6)+80px)] [@media(min-width:_720px)]:p-[var(--sp-4)_var(--sp-6)_calc(var(--sp-6)+80px)]"
  data-testid="admin-home"
>
  <p class="px-1 text-12 leading-relaxed text-ink-3">
    관리 기능은 서버 연결 뒤에 차례로 엽니다.
  </p>

  <p class="px-1 pt-2 text-12 font-bold tracking-wide text-hint">관리</p>
  <ul class="m-0 list-none rounded-panel bg-panel p-0 shadow-panel" aria-label="관리">
    <li
      class="flex min-h-12 items-center gap-3 border-b border-border px-4 py-3 text-14 text-ink-3"
      aria-disabled="true"
      data-testid="admin-notices"
    >
      <span class="flex size-5 flex-none items-center justify-center"><app-icon name="megaphone" [size]="18" /></span>
      <span class="flex-1">공지 관리</span>
      <span class="text-12">준비 중</span>
    </li>
    <li
      class="flex min-h-12 items-center gap-3 px-4 py-3 text-14 text-ink-3"
      aria-disabled="true"
      data-testid="admin-inquiries"
    >
      <span class="flex size-5 flex-none items-center justify-center"><app-icon name="mail" [size]="18" /></span>
      <span class="flex-1">문의 관리</span>
      <span class="text-12">준비 중</span>
    </li>
  </ul>
</div>
```

- [ ] **Step 7: 앱 라우트 연결**

`app.routes.ts`의 `stats` 항목과 `{ path: '**', ... }` 사이에 넣는다. 로그인 확인은 `requireAdmin` 안에서 하므로 `signedIn`을 따로 걸지 않는다.

```ts
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
```

- [ ] **Step 8: 내 정보에 관리자 메뉴 추가**

`account.ts`:
- import 추가: `import { AdminAccess } from '../../../admin/data/admin-access';`
- 필드 추가(`private readonly support = ...` 다음): `readonly admin = inject(AdminAccess);`
- 생성자의 `void this.loadCounts();` 다음 줄: `void this.admin.check();`

`account.html`에서 `<p class="px-1 pt-2 text-12 font-bold tracking-wide text-hint">계정</p>` 바로 앞에 넣는다.

```html
    <!-- 관리자에게만 보인다. 일반 사용자에게는 자리도 남기지 않는다. -->
    @if (admin.isAdmin()) {
      <p class="px-1 pt-2 text-12 font-bold tracking-wide text-hint">관리</p>
      <nav class="rounded-panel bg-panel shadow-panel" aria-label="관리">
        <a
          class="flex min-h-12 items-center gap-3 px-4 py-3 text-14 text-ink no-underline"
          routerLink="/admin"
          data-testid="go-admin"
        >
          <span class="flex size-5 flex-none items-center justify-center text-ink-3"><app-icon name="shield" [size]="18" /></span>
          <span class="flex-1">관리자</span>
          <span class="flex size-4 flex-none items-center justify-center text-border-strong"><app-icon name="chevron-right" [size]="16" /></span>
        </a>
      </nav>
    }
```

- [ ] **Step 9: E2E 작성**

`app/e2e/admin.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, resetApp } from './helpers';

/**
 * 관리자 메뉴와 /admin 진입을 검증한다. 관리자 여부는 서버 함수
 * is_admin의 응답을 가로채 정한다. 실제 서버 규칙은 SQL 검증이 맡는다.
 */

async function answerIsAdmin(page: Page, admin: boolean): Promise<void> {
  await page.route('**/rest/v1/rpc/is_admin', (route) => route.fulfill({ json: admin }));
}

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('관리자는 내 정보에서 관리자 화면으로 들어간다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.goto('/account');
  await page.getByTestId('go-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('admin-home')).toBeVisible();
  await expect(page.getByTestId('admin-notices')).toContainText('준비 중');
  await expect(page.getByTestId('admin-inquiries')).toContainText('준비 중');
  await expectNoHorizontalScroll(page);
});

test('일반 사용자에게는 관리자 메뉴가 없다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/account');
  await expect(page.getByTestId('go-notices')).toBeVisible();
  await expect(page.getByTestId('go-admin')).toHaveCount(0);
});

test('일반 사용자가 주소를 직접 입력하면 내 정보로 돌아간다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('admin-home')).toHaveCount(0);
});

test('관리자 여부를 확인하지 못하면 막는다', async ({ page }) => {
  await page.route('**/rest/v1/rpc/is_admin', (route) =>
    route.fulfill({ status: 500, json: { message: 'boom' } }),
  );
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('go-admin')).toHaveCount(0);
});
```

- [ ] **Step 10: 전체 검증**

Run (`app/`에서):

```bash
npx vitest run
npm run lint
npx playwright test e2e/admin.spec.ts e2e/account.spec.ts e2e/auth.spec.ts
npm run build
```

Expected: 단위 테스트 전부 통과(기준 535 + 새 10). lint는 기준 오류 한 줄 외에 새 오류 없음. E2E는 desktop·mobile-360 두 프로젝트 모두 통과. 운영 빌드 성공(기존 예산 경고는 유지될 수 있다).

- [ ] **Step 11: Commit**

```bash
git add app/src/app/features/admin app/src/app/app.routes.ts app/src/app/shared/ui/icon/icon.ts app/src/app/features/auth/feature/account app/e2e/admin.spec.ts
git commit -m "feat(app): 관리자에게만 보이는 관리자 진입 화면을 둔다

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 문서 갱신

**Files:**
- Modify: `docs/기획안-v0.1.md` (36절 "관리자 화면 (미구현)"·"표 구조 (미구현)")
- Modify: `openspec/changes/plan-travel-companion-mvp/tasks.md` (14.8·14.9와 그 아래 검증 기록)
- Modify: `docs/architecture/DATABASE.md` ("접근 제어" 다음에 "관리자 판별" 절, "적용 현황"에 한 줄)
- Modify: `docs/DEVELOPMENT.md` (현재 구현 표의 고객 지원 행)
- Modify: `docs/README.md` (개발·운영 기준 표에 스펙 링크)

**Interfaces:**
- Consumes: Task 1–3의 실제 검증 결과(테스트 수, 빌드 결과). 문서에는 실제로 확인한 숫자만 적는다.

- [ ] **Step 1: 기획안 36절**

"### 관리자 화면 (미구현)" 제목을 "### 관리자 화면 (진입 화면 구현, 관리 기능 미구현)"으로 바꾸고 절 끝에 다음 문단을 더한다.

```markdown
2026-09-29 구현 범위: `profiles.role`과 서버 함수 `is_admin()`, `/admin` 가드, 내 정보의 관리자 메뉴, 공지 관리·문의 관리를 "준비 중"으로 보여주는 진입 화면까지 만들었다. `profiles`는 없던 표라 역할 전용으로 새로 만들었고 닉네임은 계속 Auth `user_metadata`에 둔다. 공지·문의 서버 표와 관리 기능은 후속이다.
```

"### 표 구조 (미구현)"의 마지막 문장 "기존 `profiles`에 `role` 칸을 더한다."를 "`profiles`는 역할 전용 표로 먼저 만들었다(2026-09-29)."로 바꾼다.

- [ ] **Step 2: OpenSpec tasks.md**

14.8 줄 끝에 ` 2026-09-29 profiles.role과 is_admin()을 먼저 만들었다. 나머지 네 표는 미구현.`을 붙이고, 14.9 줄 끝에 ` 2026-09-29 가드·메뉴·진입 화면까지 구현, 공지·문의 관리는 미구현.`을 붙인다. 체크박스는 둘 다 `[ ]`로 둔다. 14.11 아래 검증 기록 문단 다음에 실제 결과로 한 문단을 추가한다.

```markdown
2026-09-29 관리자 진입 검증: 로컬 PostgreSQL 17 임시 DB에서 마이그레이션을 적용해 관리자·일반 사용자 판별, 본인 행만 조회, 사용자 쓰기 거부, anon 함수 실행 거부, 계정 삭제 연쇄를 확인했다. 단위 <N>개, 관리자·내 정보·인증 E2E <M>개(PC·360px) 통과, 운영 빌드 성공. 원격 적용과 실계정 확인은 <상태>.
```

`<N>`·`<M>`·`<상태>`는 Task 3 Step 10과 원격 적용 결과로 채운다. 확인하지 않은 항목은 "미확인"으로 적는다.

- [ ] **Step 3: DATABASE.md**

"## 접근 제어" 절 끝(“한 번만 계산하게 한다.” 문단 다음)에 넣는다.

````markdown
### 관리자 판별

`profiles(id, role)`은 역할 전용 표다. 행이 없으면 일반 사용자다. 본인 행 조회만 허용하고 쓰기 정책은 두지 않아 사용자가 스스로 관리자가 될 수 없다. 계정을 지우면 함께 지운다.

후속 공지·문의 표의 RLS는 `is_admin()`을 호출한다. `security definer`라 RLS와 무관하게 역할을 읽고, `search_path`를 비워 둔다. 실행 권한은 `authenticated`만 가진다.

관리자 부여는 화면이 아니라 SQL로 직접 한다. 대상 계정이 한 번 이상 로그인해 있어야 한다. 이메일은 저장소에 적지 않는다.

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = '<관리자 이메일>'
on conflict (id) do update set role = excluded.role;
```
````

"## 적용 현황"에 `- 2026-09-29 \`20260929100000_profiles_role.sql\` 작성. 로컬 PostgreSQL 검증 완료, 원격 적용은 <상태>.`를 추가한다.

- [ ] **Step 4: DEVELOPMENT.md**

고객 지원 행을 다음으로 바꾼다.

```markdown
| 고객 지원 | 공지사항 목록, 문의 목록·보내기, 알림 스위치, 개인정보 처리방침·이용약관. 기기 저장이며 서버 저장은 후속. 관리자 판별(`profiles.role`·`is_admin()`)과 `/admin` 진입 화면 구현, 공지·문의 관리는 후속 |
```

- [ ] **Step 5: docs/README.md**

"개발·운영 기준" 표의 챗봇 설계 행 다음에 넣는다.

```markdown
| [관리자 권한 설계](superpowers/specs/2026-09-29-admin-access-design.md) | 관리자 판별 방식·`/admin` 진입 범위와 근거. 요구사항은 기획안 36절에 있다 |
```

- [ ] **Step 6: 링크 확인과 Commit**

Run: `grep -n "2026-09-29-admin-access-design" docs/README.md` → 1줄.

```bash
git add docs openspec
git commit -m "docs: 관리자 판별과 진입 화면 구현 범위를 기록한다

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 원격 적용과 관리자 부여 (사용자 확인 필요)

이 작업은 공유 원격 DB를 바꾸므로 실행 전에 반드시 사용자에게 방법과 명령을 보여주고 승인을 받는다. 서브에이전트에게 맡기지 않는다.

- [ ] **Step 1: 적용 방법 확인**

원격에는 `feat/supabase-ledger`의 마이그레이션(`20260929000000`~`20260929000002`)이 이미 적용되었을 수 있다. 이 브랜치에는 그 파일이 없으므로 여기서 `npx supabase db push`를 실행하면 원격 이력과 어긋나 거부되거나 잘못 적용될 수 있다. 사용자와 다음 중 하나를 정한다.
- Supabase 대시보드 SQL Editor에서 마이그레이션 SQL을 실행하고 `supabase_migrations.schema_migrations`에 버전을 기록한다.
- 두 브랜치를 합친 뒤 `npx supabase db push`로 적용한다.

- [ ] **Step 2: 관리자 부여**

대상 계정이 한 번 로그인했는지 확인한 뒤 DATABASE.md "관리자 부여" SQL을 사용자가 지정한 이메일로 실행한다.

- [ ] **Step 3: 실계정 확인**

해당 계정으로 로그인해 내 정보에 "관리자" 줄이 보이고 `/admin`이 열리는지, 다른 계정에서는 보이지 않는지 확인한다. 결과를 Task 4의 `<상태>` 자리에 반영해 문서를 커밋한다.
