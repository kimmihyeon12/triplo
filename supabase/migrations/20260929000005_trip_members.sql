-- 친구 초대와 함께 편집(2026-09-29).
-- 설계: docs/superpowers/specs/2026-09-29-trip-members-design.md
--
-- 1) 여행 멤버·초대 표를 두고, 읽기 정책을 '본인 여행'에서 '참여한 여행'으로 넓힌다.
-- 2) 여행·가계부 표의 직접 쓰기 권한을 거두고, 쓰기는 모두 함수로만 한다.
--    함수는 security definer라 RLS를 건너뛰므로 멤버 확인을 함수 안에서 한다.

create extension if not exists pgcrypto with schema extensions;

-- ── 표 ────────────────────────────────────────────────────────────────

create table public.trip_members (
  trip_id text not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  -- 합류 시점의 닉네임. 다른 사람의 계정 정보는 읽을 수 없어 여기에 둔다.
  nickname text not null default '',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members (user_id);

-- 여행마다 살아 있는 초대 링크는 하나다. 코드는 해시만 둔다.
create table public.trip_invites (
  trip_id text primary key references public.trips (id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 기존 여행의 주인을 멤버로 채운다.
insert into public.trip_members (trip_id, user_id, role, nickname)
select t.id, t.owner_id, 'owner', coalesce(u.raw_user_meta_data->>'travel_nickname', '')
  from public.trips t join auth.users u on u.id = t.owner_id;

-- 개인 지출은 쓴 사람만 본다. 기존 지출은 여행 주인이 쓴 것으로 채운다.
alter table public.expenses
  add column created_by uuid references auth.users (id) on delete set null;
update public.expenses e set created_by = t.owner_id from public.trips t where t.id = e.trip_id;
alter table public.expenses alter column created_by set default auth.uid();

-- 분담은 지출과 같은 여행에만 달린다.
alter table public.expenses add constraint expenses_id_trip_key unique (id, trip_id);
alter table public.expense_splits
  add constraint expense_splits_expense_trip_fkey
  foreign key (expense_id, trip_id) references public.expenses (id, trip_id) on delete cascade;

-- ── 멤버 확인 ─────────────────────────────────────────────────────────
-- 정책이 trip_members를 읽을 때 그 정책이 다시 걸려 돌지 않도록 definer로 둔다.

create function public.is_trip_member(target text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members
     where trip_id = target and user_id = (select auth.uid())
  );
$$;

create function public.is_trip_owner(target text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trips where id = target and owner_id = (select auth.uid())
  );
$$;

-- ── 읽기 정책 ─────────────────────────────────────────────────────────

drop policy trips_owner_all on public.trips;
drop policy trip_regions_owner_all on public.trip_regions;
drop policy trip_stops_owner_all on public.trip_stops;
drop policy accommodation_stays_owner_all on public.accommodation_stays;
drop policy trip_ledgers_owner_all on public.trip_ledgers;
drop policy ledger_people_owner_all on public.ledger_people;
drop policy expenses_owner_all on public.expenses;
drop policy expense_splits_owner_all on public.expense_splits;
drop policy settlement_receipts_owner_all on public.settlement_receipts;

create policy trips_member_read on public.trips for select using (public.is_trip_member(id));
create policy trip_regions_member_read on public.trip_regions for select using (public.is_trip_member(trip_id));
create policy trip_stops_member_read on public.trip_stops for select using (public.is_trip_member(trip_id));
create policy accommodation_stays_member_read on public.accommodation_stays for select using (public.is_trip_member(trip_id));
create policy trip_ledgers_member_read on public.trip_ledgers for select using (public.is_trip_member(trip_id));
create policy ledger_people_member_read on public.ledger_people for select using (public.is_trip_member(trip_id));
create policy expenses_member_read on public.expenses for select
  using (public.is_trip_member(trip_id) and (not personal or created_by = (select auth.uid())));
create policy expense_splits_member_read on public.expense_splits for select
  using (public.is_trip_member(trip_id) and exists (
    select 1 from public.expenses e
     where e.id = expense_id and (not e.personal or e.created_by = (select auth.uid()))));
create policy settlement_receipts_member_read on public.settlement_receipts for select using (public.is_trip_member(trip_id));

alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
create policy trip_members_member_read on public.trip_members for select using (public.is_trip_member(trip_id));
create policy trip_invites_owner_read on public.trip_invites for select using (public.is_trip_owner(trip_id));

-- 표는 읽기만. 쓰기는 아래 함수로만 한다.
revoke insert, update, delete
  on public.trips, public.trip_regions, public.trip_stops, public.accommodation_stays,
     public.trip_ledgers, public.ledger_people, public.expenses, public.expense_splits,
     public.settlement_receipts
  from authenticated;
revoke all on public.trip_members, public.trip_invites from public, anon, authenticated;
grant select on public.trip_members, public.trip_invites to authenticated;

-- ── 여행 저장·삭제 ────────────────────────────────────────────────────

create or replace function public.save_trip(p_trip jsonb, p_base_version integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := p_trip->>'id';
  v_current integer;
  v_next integer;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select version into v_current from public.trips where id = v_id for update;

  if not found then
    if p_base_version <> 0 then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    insert into public.trips (id, owner_id, title, start_date, end_date, status,
                              schema_version, created_at, updated_at, version)
    values (v_id, v_uid, p_trip->>'title',
            (p_trip->>'startDate')::date, (p_trip->>'endDate')::date, 'draft',
            coalesce((p_trip->>'schemaVersion')::smallint, 1),
            coalesce((p_trip->>'createdAt')::timestamptz, now()),
            coalesce((p_trip->>'updatedAt')::timestamptz, now()), 1);
    insert into public.trip_members (trip_id, user_id, role, nickname)
    select v_id, v_uid, 'owner', coalesce(u.raw_user_meta_data->>'travel_nickname', '')
      from auth.users u where u.id = v_uid;
    v_next := 1;
  else
    -- 남의 여행이면 있는지조차 알리지 않는다.
    if not public.is_trip_member(v_id) then
      raise exception 'not_found' using errcode = 'P0404';
    end if;
    if v_current <> p_base_version then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    v_next := v_current + 1;
    update public.trips
       set title = p_trip->>'title',
           start_date = (p_trip->>'startDate')::date,
           end_date = (p_trip->>'endDate')::date,
           updated_at = coalesce((p_trip->>'updatedAt')::timestamptz, now()),
           version = v_next
     where id = v_id;
  end if;

  delete from public.trip_stops where trip_id = v_id;
  delete from public.accommodation_stays where trip_id = v_id;
  delete from public.trip_regions where trip_id = v_id;

  insert into public.trip_regions (id, trip_id, name, "order", region_code)
  select r->>'id', v_id, r->>'name', (r->>'order')::integer, r->>'regionCode'
    from jsonb_array_elements(coalesce(p_trip->'regions', '[]'::jsonb)) as r;

  insert into public.trip_stops (id, trip_id, region_id, kind, name, address, date, "order",
                                 stay_minutes, memo, fixed_time, excluded, location_status,
                                 lat, lng, place_provider, place_id, place_url, estimated_cost)
  select s->>'id', v_id, s->>'regionId', (s->>'kind')::public.stop_kind, s->>'name',
         coalesce(s->>'address', ''), (s->>'date')::date, (s->>'order')::integer,
         (s->>'stayMinutes')::integer, coalesce(s->>'memo', ''), s->>'fixedTime',
         coalesce((s->>'excluded')::boolean, false),
         coalesce(s->>'locationStatus', 'unverified')::public.location_status,
         (s->'location'->>'lat')::double precision, (s->'location'->>'lng')::double precision,
         s->'placeRef'->>'provider', s->'placeRef'->>'id', s->'placeRef'->>'url',
         (s->>'estimatedCost')::integer
    from jsonb_array_elements(coalesce(p_trip->'stops', '[]'::jsonb)) as s;

  insert into public.accommodation_stays (id, trip_id, region_id, name, address, check_in,
                                          check_out, check_in_time, check_out_time, day_order,
                                          reservation, memo, location_status, lat, lng,
                                          place_provider, place_id, place_url, estimated_cost)
  select a->>'id', v_id, a->>'regionId', a->>'name', coalesce(a->>'address', ''),
         (a->>'checkIn')::date, (a->>'checkOut')::date, a->>'checkInTime', a->>'checkOutTime',
         (a->>'dayOrder')::integer,
         coalesce(a->>'reservation', 'unknown')::public.reservation_state,
         coalesce(a->>'memo', ''),
         coalesce(a->>'locationStatus', 'unverified')::public.location_status,
         (a->'location'->>'lat')::double precision, (a->'location'->>'lng')::double precision,
         a->'placeRef'->>'provider', a->'placeRef'->>'id', a->'placeRef'->>'url',
         (a->>'estimatedCost')::integer
    from jsonb_array_elements(coalesce(p_trip->'stays', '[]'::jsonb)) as a;

  return v_next;
end;
$$;

-- 여행 삭제는 주인만. 딸린 행은 cascade로 사라진다.
create function public.delete_trip(p_trip_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  delete from public.trips where id = p_trip_id;
end;
$$;

-- ── 가계부 함수 ───────────────────────────────────────────────────────

create or replace function public.ledger_guard(p_trip_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_trip_member(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
end;
$$;

create or replace function public.save_expense(p_trip_id text, p_expense jsonb, p_base_version integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := p_expense->>'id';
  v_current integer;
  v_trip text;
  v_old_personal boolean;
  v_author uuid;
  v_next integer;
  v_amount integer := (p_expense->>'amount')::integer;
  v_personal boolean := coalesce((p_expense->>'personal')::boolean, false);
begin
  perform public.ledger_guard(p_trip_id);
  select version, trip_id, personal, created_by
    into v_current, v_trip, v_old_personal, v_author
    from public.expenses where id = v_id for update;
  if not found then
    if p_base_version <> 0 then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    insert into public.expenses (id, trip_id, title, date, category, amount, paid_by, memo,
                                 link_id, personal, version, created_by)
    values (v_id, p_trip_id, btrim(p_expense->>'title'), (p_expense->>'date')::date, p_expense->>'category',
            v_amount, p_expense->>'paidBy', coalesce(p_expense->>'memo', ''), p_expense->>'linkId',
            v_personal, 1, v_uid);
    v_next := 1;
  else
    if v_trip <> p_trip_id then
      raise exception 'not_found' using errcode = 'P0404';
    end if;
    -- 남의 개인 지출은 보이지도 않으므로 고칠 수 없다. 남의 공동 지출을 개인으로 돌려
    -- 다른 멤버에게서 감추는 것도 막는다.
    if (v_old_personal or v_personal) and v_author is distinct from v_uid then
      raise exception 'not_found' using errcode = 'P0404';
    end if;
    if v_current <> p_base_version then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    v_next := v_current + 1;
    update public.expenses
       set title = btrim(p_expense->>'title'), date = (p_expense->>'date')::date,
           category = p_expense->>'category', amount = v_amount, paid_by = p_expense->>'paidBy',
           memo = coalesce(p_expense->>'memo', ''), link_id = p_expense->>'linkId',
           personal = v_personal, version = v_next
     where id = v_id;
  end if;

  delete from public.expense_splits where expense_id = v_id;
  insert into public.expense_splits (expense_id, trip_id, person_id, amount)
  select v_id, p_trip_id, s->>'personId', (s->>'amount')::integer
    from jsonb_array_elements(coalesce(p_expense->'splits', '[]'::jsonb)) as s;

  if not v_personal and (
       (select count(*) from public.expense_splits where expense_id = v_id) = 0
       or (select sum(amount) from public.expense_splits where expense_id = v_id) <> v_amount) then
    raise exception 'split_mismatch' using errcode = 'P0422';
  end if;
  return v_next;
end;
$$;

create or replace function public.delete_expense(p_trip_id text, p_expense_id text, p_base_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_current integer;
  v_personal boolean;
  v_author uuid;
begin
  perform public.ledger_guard(p_trip_id);
  select version, personal, created_by into v_current, v_personal, v_author
    from public.expenses where id = p_expense_id and trip_id = p_trip_id for update;
  if not found or (v_personal and v_author is distinct from (select auth.uid())) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if v_current <> p_base_version then
    raise exception 'conflict' using errcode = 'P0409';
  end if;
  delete from public.expenses where id = p_expense_id;
end;
$$;

-- 나머지 가계부 함수는 본문이 ledger_guard로 확인하므로 실행 권한만 바꾼다.
alter function public.add_ledger_person(text, jsonb) security definer;
alter function public.add_receipt(text, jsonb) security definer;
alter function public.cancel_receipt(text, text, text) security definer;
alter function public.set_budget(text, integer) security definer;
alter function public.remove_ledger_person(text, text) security definer;

-- ── 초대 ──────────────────────────────────────────────────────────────

-- 헷갈리는 글자(0·O·1·I)를 뺀 32자에서 8자를 고른다. 256은 32로 나누어떨어져 치우치지 않는다.
create function public.new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- 받은 코드를 대문자로 바꾸고 문자·숫자만 남겨 해시한다. 'abcd-efgh'도 같다.
create function public.invite_hash(p_code text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
$$;

-- 유효한 초대의 여행 id. 없는 코드·만료·취소는 모두 같은 오류다.
create function public.invite_trip(p_code text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_trip text;
begin
  select trip_id into v_trip from public.trip_invites
   where code_hash = public.invite_hash(p_code) and expires_at > now();
  if v_trip is null then
    raise exception 'invite_invalid' using errcode = 'P0404';
  end if;
  return v_trip;
end;
$$;

create function public.create_trip_invite(p_trip_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text := public.new_invite_code();
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  insert into public.trip_invites (trip_id, code_hash, created_by, expires_at)
  values (p_trip_id, public.invite_hash(v_code), (select auth.uid()), now() + interval '7 days')
  on conflict (trip_id) do update
    set code_hash = excluded.code_hash, created_by = excluded.created_by,
        expires_at = excluded.expires_at, created_at = now();
  return v_code;
end;
$$;

create function public.revoke_trip_invite(p_trip_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  delete from public.trip_invites where trip_id = p_trip_id;
end;
$$;

-- 로그인 전에도 보는 미리보기. 메모·예약·금액·주소·가계부는 담지 않는다.
create function public.preview_trip_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_trip text := public.invite_trip(p_code);
begin
  return (
    select jsonb_build_object(
      'title', t.title,
      'startDate', t.start_date,
      'endDate', t.end_date,
      'ownerNickname', (select m.nickname from public.trip_members m
                         where m.trip_id = t.id and m.role = 'owner'),
      'regions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'order', r."order")
                                            order by r."order")
                             from public.trip_regions r where r.trip_id = t.id), '[]'::jsonb),
      'stops', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'kind', s.kind, 'date', s.date,
                                                             'order', s."order", 'fixedTime', s.fixed_time,
                                                             'regionId', s.region_id)
                                          order by s.date nulls last, s."order")
                           from public.trip_stops s where s.trip_id = t.id and not s.excluded), '[]'::jsonb),
      'stays', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'checkIn', a.check_in,
                                                             'checkOut', a.check_out)
                                          order by a.check_in)
                           from public.accommodation_stays a where a.trip_id = t.id), '[]'::jsonb))
      from public.trips t where t.id = v_trip);
end;
$$;

-- 초대로 합류한다. 이미 멤버면 그대로 두고, 새로 들어오면 가계부에 이름을 한 명 더한다.
create function public.join_trip(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_trip text;
  v_nickname text;
  v_added integer;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  v_trip := public.invite_trip(p_code);
  select coalesce(nullif(btrim(raw_user_meta_data->>'travel_nickname'), ''), '친구')
    into v_nickname from auth.users where id = v_uid;
  insert into public.trip_members (trip_id, user_id, role, nickname)
  values (v_trip, v_uid, 'editor', v_nickname)
  on conflict (trip_id, user_id) do nothing;
  get diagnostics v_added = row_count;
  if v_added > 0 then
    insert into public.ledger_people (trip_id, id, name, "order")
    values (v_trip, 'member-' || v_uid, left(v_nickname, 40),
            coalesce((select max("order") + 1 from public.ledger_people where trip_id = v_trip), 0))
    on conflict (trip_id, id) do nothing;
  end if;
  return v_trip;
end;
$$;

-- 주인이 아닌 멤버가 스스로 나간다. 주인은 나갈 수 없다(여행을 지운다).
create function public.leave_trip(p_trip_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  select role into v_role from public.trip_members
   where trip_id = p_trip_id and user_id = (select auth.uid());
  if v_role is null then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if v_role = 'owner' then
    raise exception 'owner_cannot_leave' using errcode = 'P0422';
  end if;
  delete from public.trip_members where trip_id = p_trip_id and user_id = (select auth.uid());
end;
$$;

-- 주인이 멤버를 뺀다. 빠진 사람이 쓴 지출은 남는다.
create function public.remove_trip_member(p_trip_id text, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'owner_cannot_leave' using errcode = 'P0422';
  end if;
  delete from public.trip_members where trip_id = p_trip_id and user_id = p_user_id;
end;
$$;

-- ── 실행 권한 ─────────────────────────────────────────────────────────

revoke all on function public.new_invite_code(), public.invite_hash(text), public.invite_trip(text)
  from public, anon, authenticated;
revoke all on function public.is_trip_member(text), public.is_trip_owner(text),
  public.delete_trip(text), public.create_trip_invite(text), public.revoke_trip_invite(text),
  public.preview_trip_invite(text), public.join_trip(text), public.leave_trip(text),
  public.remove_trip_member(text, uuid)
  from public, anon;
grant execute on function public.is_trip_member(text), public.is_trip_owner(text),
  public.delete_trip(text), public.create_trip_invite(text), public.revoke_trip_invite(text),
  public.preview_trip_invite(text), public.join_trip(text), public.leave_trip(text),
  public.remove_trip_member(text, uuid)
  to authenticated;
grant execute on function public.preview_trip_invite(text) to anon;
