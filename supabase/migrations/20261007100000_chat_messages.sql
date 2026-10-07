-- AI 대화 기록을 서버에 남긴다(2026-10-07). 본인만 읽고, 쓰기는 아래 함수로만 한다.
-- 메시지 한 줄이 행 하나다. 메시지는 만든 뒤 고치지 않으므로 두 기기가 같은 대화에 써도 서로 덮지 않는다.
-- 대화는 (계정, 여행)으로 나뉜다. 여행 목록에서 연 대화는 trip_id가 null이다.
create table public.chat_messages (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  trip_id text references public.trips (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  kind text check (kind is null or kind in ('explore', 'draft', 'reference', 'outside', 'refusal')),
  text text not null check (char_length(text) <= 4000),
  extra jsonb not null default '{}' check (jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 65536),
  at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index chat_messages_thread_idx on public.chat_messages (user_id, trip_id, at desc);

alter table public.chat_messages enable row level security;
create policy chat_messages_read_own on public.chat_messages for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.chat_messages from public, anon, authenticated;
grant select on public.chat_messages to authenticated;

-- 한 줄을 검사해 넣는다. 같은 id가 있으면 무시하고 false. 형식이 틀리면 P0400.
create function public.insert_chat_message(p_user uuid, p_trip_id text, p_message jsonb) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare v_at timestamptz; v_extra jsonb := coalesce(p_message -> 'extra', '{}'::jsonb);
begin
  if jsonb_typeof(p_message) is distinct from 'object'
     or jsonb_typeof(p_message -> 'id') is distinct from 'string'
     or jsonb_typeof(p_message -> 'text') is distinct from 'string'
     or coalesce(p_message ->> 'role', '') not in ('user', 'assistant', 'system')
     or char_length(p_message ->> 'text') > 4000
     or jsonb_typeof(v_extra) is distinct from 'object'
     or octet_length(v_extra::text) > 65536 then
    raise exception 'invalid_message' using errcode = 'P0400';
  end if;
  begin
    v_at := (p_message ->> 'at')::timestamptz;
  exception when others then
    raise exception 'invalid_message' using errcode = 'P0400';
  end;
  if v_at is null then raise exception 'invalid_message' using errcode = 'P0400'; end if;
  insert into public.chat_messages (user_id, id, trip_id, role, kind, text, extra, at)
  values (p_user, p_message ->> 'id', p_trip_id, p_message ->> 'role', nullif(p_message ->> 'kind', ''),
          p_message ->> 'text', v_extra, v_at)
  on conflict (user_id, id) do nothing;
  return found;
exception when check_violation then
  raise exception 'invalid_message' using errcode = 'P0400';
end;
$$;

-- 그 대화의 최근 200줄 밖을 지운다.
create function public.trim_chat_thread(p_user uuid, p_trip_id text) returns void
  language sql security definer set search_path = '' as $$
  delete from public.chat_messages
   where ctid in (
     select ctid from public.chat_messages
      where user_id = p_user and trip_id is not distinct from p_trip_id
      order by at desc, id desc
      offset 200
   );
$$;

-- 여행 대화를 남길 수 있는지. 여행이 없거나 멤버가 아니면 false.
create function public.can_chat_in(p_trip_id text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select p_trip_id is null or public.is_trip_member(p_trip_id);
$$;

create function public.append_chat_message(p_trip_id text, p_message jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if not public.can_chat_in(p_trip_id) then raise exception 'not_member' using errcode = '42501'; end if;
  perform public.insert_chat_message(v_user, p_trip_id, p_message);
  perform public.trim_chat_thread(v_user, p_trip_id);
end;
$$;

-- 기기 기록 옮기기. 서버 대화에 메시지 id로 합친다. 이미 있는 줄은 다시 넣지 않고, 남길 수 없는 여행의
-- 대화와 깨진 줄은 건너뛴다. 대화를 통째로 건너뛰면 옮기기가 한 번 실패한 사이 새로 쓴 줄 때문에
-- 다음 옮기기에서 옛 기록이 버려진다. 앱은 대화별로 나눠 보내고 성공한 대화만 기기에서 지운다.
create function public.import_chat_threads(p_threads jsonb) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_key text; v_messages jsonb; v_trip text; v_message jsonb; v_count integer := 0; v_len integer;
begin
  if v_user is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_threads) is distinct from 'object' or octet_length(p_threads::text) > 2000000 then
    raise exception 'invalid_threads' using errcode = 'P0400';
  end if;
  for v_key, v_messages in select key, value from jsonb_each(p_threads) loop
    v_trip := nullif(v_key, '__list__');
    continue when jsonb_typeof(v_messages) is distinct from 'array';
    continue when not public.can_chat_in(v_trip);
    v_len := jsonb_array_length(v_messages);
    for v_message in select value from jsonb_array_elements(v_messages) with ordinality e(value, n)
                      where n > v_len - 200 loop
      begin
        if public.insert_chat_message(v_user, v_trip, v_message) then v_count := v_count + 1; end if;
      exception when sqlstate 'P0400' then
        null;
      end;
    end loop;
    perform public.trim_chat_thread(v_user, v_trip);
  end loop;
  return v_count;
end;
$$;

create function public.clear_chat(p_trip_id text) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  delete from public.chat_messages where user_id = auth.uid() and trip_id is not distinct from p_trip_id;
end;
$$;

revoke execute on function
  public.insert_chat_message(uuid, text, jsonb), public.trim_chat_thread(uuid, text), public.can_chat_in(text),
  public.append_chat_message(text, jsonb), public.import_chat_threads(jsonb), public.clear_chat(text)
  from public, anon, authenticated;
grant execute on function
  public.append_chat_message(text, jsonb), public.import_chat_threads(jsonb), public.clear_chat(text)
  to authenticated;
