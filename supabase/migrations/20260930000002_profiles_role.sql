-- 관리자 판별용 역할 표. 기획안 36절에 따라 관리자는 profiles.role로 가려낸다.
-- 닉네임은 아직 Auth user_metadata에 있으므로 이 표에는 역할만 둔다(2026-09-29).
-- 행이 없으면 일반 사용자다. 가입 때 행을 만드는 트리거는 두지 않는다.
--
-- 관리자 부여는 화면이 아니라 SQL로 직접 한다. 이메일을 이 파일에 적지 않는다.
-- 형식은 docs/architecture/DATABASE.md '관리자 판별'을 본다.

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

-- Supabase의 기본 권한 설정이 새 표에 anon·authenticated 권한을 줄 수 있으므로
-- 먼저 모두 거두고 필요한 것만 준다. 쓰기는 RLS 정책이 없어도 권한에서 막는다.
revoke all on public.profiles from anon, authenticated;
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

-- public에서 거두는 것만으로는 Supabase가 anon에 직접 준 권한이 남는다.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
