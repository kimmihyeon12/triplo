-- 가계부를 여행별로 저장한다. 설계: docs/superpowers/specs/2026-09-29-supabase-ledger-storage-design.md
-- 동작 한 건씩 저장해 친구 공동 편집에서 동시 추가가 막히지 않게 한다.

create table trip_ledgers (
  trip_id text primary key references trips (id) on delete cascade,
  budget integer,
  constraint trip_ledgers_budget_not_negative check (budget is null or budget >= 0)
);

-- '나'(self)가 여행마다 있으므로 id는 여행 안에서만 고유하다.
create table ledger_people (
  trip_id text not null references trips (id) on delete cascade,
  id text not null,
  name text not null,
  "order" integer not null,
  primary key (trip_id, id),
  constraint ledger_people_name check (btrim(name) <> '' and char_length(name) <= 40)
);

create table expenses (
  id text primary key,
  trip_id text not null references trips (id) on delete cascade,
  title text not null,
  date date not null,
  category text not null,
  amount integer not null,
  paid_by text not null,
  memo text not null default '',
  link_id text,
  personal boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  foreign key (trip_id, paid_by) references ledger_people (trip_id, id),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_title check (btrim(title) <> '' and char_length(title) <= 100)
);
create index expenses_trip_idx on expenses (trip_id);

create table expense_splits (
  expense_id text not null references expenses (id) on delete cascade,
  trip_id text not null,
  person_id text not null,
  amount integer not null,
  primary key (expense_id, person_id),
  foreign key (trip_id, person_id) references ledger_people (trip_id, id),
  constraint expense_splits_amount check (amount >= 0)
);
create index expense_splits_trip_idx on expense_splits (trip_id);

-- 취소해도 행은 남긴다. 취소 사유가 있으면 정산에서 뺀다.
create table settlement_receipts (
  id text primary key,
  trip_id text not null references trips (id) on delete cascade,
  from_person text not null,
  to_person text not null,
  amount integer not null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  foreign key (trip_id, from_person) references ledger_people (trip_id, id),
  foreign key (trip_id, to_person) references ledger_people (trip_id, id),
  constraint receipts_amount_positive check (amount > 0),
  constraint receipts_people_differ check (from_person <> to_person),
  constraint receipts_reason check (cancelled_reason is null or btrim(cancelled_reason) <> '')
);
create index settlement_receipts_trip_idx on settlement_receipts (trip_id);

alter table trip_ledgers enable row level security;
alter table ledger_people enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlement_receipts enable row level security;

create policy trip_ledgers_owner_all on trip_ledgers for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy ledger_people_owner_all on ledger_people for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy expenses_owner_all on expenses for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy expense_splits_owner_all on expense_splits for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));
create policy settlement_receipts_owner_all on settlement_receipts for all
  using (owns_trip(trip_id)) with check (owns_trip(trip_id));

grant select, insert, update, delete
  on public.trip_ledgers, public.ledger_people, public.expenses,
     public.expense_splits, public.settlement_receipts
  to authenticated;

-- 모든 함수의 입구. 로그인과 여행 소유를 확인한다.
create function ledger_guard(p_trip_id text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.owns_trip(p_trip_id) then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
end;
$$;

create function add_ledger_person(p_trip_id text, p_person jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  insert into public.ledger_people (trip_id, id, name, "order")
  values (p_trip_id, p_person->>'id', btrim(p_person->>'name'),
          coalesce((select max("order") + 1 from public.ledger_people where trip_id = p_trip_id), 0))
  on conflict (trip_id, id) do update set name = excluded.name;
end;
$$;

create function save_expense(p_trip_id text, p_expense jsonb, p_base_version integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_id text := p_expense->>'id';
  v_current integer;
  v_trip text;
  v_next integer;
  v_amount integer := (p_expense->>'amount')::integer;
  v_personal boolean := coalesce((p_expense->>'personal')::boolean, false);
begin
  perform public.ledger_guard(p_trip_id);
  select version, trip_id into v_current, v_trip from public.expenses where id = v_id for update;
  if not found then
    if p_base_version <> 0 then
      raise exception 'conflict' using errcode = 'P0409';
    end if;
    insert into public.expenses (id, trip_id, title, date, category, amount, paid_by, memo, link_id, personal, version)
    values (v_id, p_trip_id, btrim(p_expense->>'title'), (p_expense->>'date')::date, p_expense->>'category',
            v_amount, p_expense->>'paidBy', coalesce(p_expense->>'memo', ''), p_expense->>'linkId', v_personal, 1);
    v_next := 1;
  else
    if v_trip <> p_trip_id then
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

create function delete_expense(p_trip_id text, p_expense_id text, p_base_version integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_current integer;
begin
  perform public.ledger_guard(p_trip_id);
  select version into v_current from public.expenses
   where id = p_expense_id and trip_id = p_trip_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
  if v_current <> p_base_version then
    raise exception 'conflict' using errcode = 'P0409';
  end if;
  delete from public.expenses where id = p_expense_id;
end;
$$;

create function add_receipt(p_trip_id text, p_receipt jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  insert into public.settlement_receipts (id, trip_id, from_person, to_person, amount)
  values (p_receipt->>'id', p_trip_id, p_receipt->>'from', p_receipt->>'to', (p_receipt->>'amount')::integer);
end;
$$;

create function cancel_receipt(p_trip_id text, p_receipt_id text, p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  update public.settlement_receipts
     set cancelled_reason = coalesce(cancelled_reason, btrim(p_reason))
   where id = p_receipt_id and trip_id = p_trip_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0404';
  end if;
end;
$$;

create function set_budget(p_trip_id text, p_budget integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ledger_guard(p_trip_id);
  insert into public.trip_ledgers (trip_id, budget) values (p_trip_id, p_budget)
  on conflict (trip_id) do update set budget = excluded.budget;
end;
$$;

revoke execute on function ledger_guard(text), add_ledger_person(text, jsonb),
  save_expense(text, jsonb, integer), delete_expense(text, text, integer),
  add_receipt(text, jsonb), cancel_receipt(text, text, text), set_budget(text, integer)
  from public, anon;
grant execute on function ledger_guard(text), add_ledger_person(text, jsonb),
  save_expense(text, jsonb, integer), delete_expense(text, text, integer),
  add_receipt(text, jsonb), cancel_receipt(text, text, text), set_budget(text, integer)
  to authenticated;
