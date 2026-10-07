import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../model/chat';

/** 서버 `chat_messages` 한 줄. 말풍선의 부가 정보는 extra에 묶는다. */
export interface ChatRow {
  id: string;
  role: string;
  kind: string | null;
  text: string;
  extra: Record<string, unknown>;
  at: string;
}

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface ChatDataClient {
  /** 그 대화의 최근 limit줄을 오래된 것부터. */
  thread(tripId: string | null, limit: number): Promise<ChatRow[]>;
  call(fn: 'append_chat_message' | 'import_chat_threads' | 'clear_chat', args: Record<string, unknown>): Promise<unknown>;
}

const ROLES = new Set(['user', 'assistant', 'system']);

export function toChatRow(message: ChatMessage): ChatRow {
  const { id, role, kind, text, at, reference, draft, chips, localLink, localLinkLabel, copyText } = message;
  const extra: Record<string, unknown> = { reference, draft, chips };
  if (localLink !== undefined) extra['localLink'] = localLink;
  if (localLinkLabel !== undefined) extra['localLinkLabel'] = localLinkLabel;
  if (copyText !== undefined) extra['copyText'] = copyText;
  return { id, role, kind, text, at, extra };
}

/** 형식이 틀린 줄은 null. 깨진 줄 하나가 대화 전체를 막지 않게 한다. */
export function fromChatRow(row: ChatRow): ChatMessage | null {
  if (typeof row.id !== 'string' || !ROLES.has(row.role) || typeof row.text !== 'string' || typeof row.at !== 'string') return null;
  const extra = row.extra ?? {};
  const message: Record<string, unknown> = {
    id: row.id,
    role: row.role,
    kind: row.kind ?? null,
    text: row.text,
    reference: extra['reference'] ?? null,
    draft: extra['draft'] ?? null,
    chips: Array.isArray(extra['chips']) ? extra['chips'] : [],
    at: new Date(row.at).toISOString(),
  };
  for (const key of ['localLink', 'localLinkLabel', 'copyText'] as const) {
    if (typeof extra[key] === 'string') message[key] = extra[key];
  }
  return message as unknown as ChatMessage;
}

export function supabaseChatDataClient(client: () => Promise<SupabaseClient>): ChatDataClient {
  return {
    async thread(tripId, limit) {
      let query = (await client())
        .from('chat_messages')
        .select('id, role, kind, text, extra, at')
        .order('at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      query = tripId === null ? query.is('trip_id', null) : query.eq('trip_id', tripId);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as ChatRow[]).reverse();
    },
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      if (error) throw error;
      return data;
    },
  };
}
