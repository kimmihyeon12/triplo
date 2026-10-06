import type { SupabaseClient } from '@supabase/supabase-js';
import type { InboxItem, InboxKind } from '../model/inbox';
import type { KeyValueStorage } from './local-push-repository';

/** 알림 내역(2026-10-06). 서버가 알림을 보낼 때 함께 남긴 것을 읽는다. 쓰기는 읽음 표시뿐이다. */
export interface NotificationInbox {
  /** 최근 것부터. 30일이 지난 것은 서버가 지운다. */
  list(): Promise<InboxItem[]>;
  unreadCount(): Promise<number>;
  markAllRead(): Promise<void>;
}

export interface InboxRow {
  id: number | string;
  kind: InboxKind;
  title: string;
  body: string;
  url: string;
  created_at: string;
  read_at: string | null;
}

export function toInboxItem(row: InboxRow): InboxItem {
  return {
    id: String(row.id),
    kind: row.kind,
    title: row.title,
    body: row.body,
    url: row.url,
    createdAt: row.created_at,
    read: row.read_at !== null,
  };
}

/** 한 번에 읽는 최대 개수. 30일 치라 이 정도면 넘치지 않는다. */
const LIMIT = 100;

/** Supabase 구현. 본인 것만 읽히는 것은 서버 RLS가 맡는다. */
export class SupabaseNotificationInbox implements NotificationInbox {
  constructor(private readonly client: () => Promise<SupabaseClient>) {}

  async list(): Promise<InboxItem[]> {
    const { data, error } = await (await this.client())
      .from('notification_inbox')
      .select('id, kind, title, body, url, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error) throw new Error('알림 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    return ((data ?? []) as InboxRow[]).map(toInboxItem);
  }

  async unreadCount(): Promise<number> {
    const { count, error } = await (await this.client())
      .from('notification_inbox')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw new Error('알림 수를 세지 못했어요.');
    return count ?? 0;
  }

  async markAllRead(): Promise<void> {
    const { error } = await (await this.client()).rpc('mark_notifications_read');
    if (error) throw new Error('읽음 표시를 하지 못했어요.');
  }
}

/**
 * 테스트 앱·미리보기 구현. 서버가 없어 처음 열면 예시 알림 세 개를 둔다(계정별 기기 저장).
 * 예시는 최근 시각으로 만들어 '분 전'·'어제' 표기를 함께 확인할 수 있게 한다.
 */
export class LocalNotificationInbox implements NotificationInbox {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private read(): InboxRow[] {
    const raw = this.storage.getItem(this.key());
    if (raw) {
      try {
        return JSON.parse(raw) as InboxRow[];
      } catch {
        // 깨진 값은 예시로 다시 채운다.
      }
    }
    const rows = sampleRows(this.now());
    this.storage.setItem(this.key(), JSON.stringify(rows));
    return rows;
  }

  async list(): Promise<InboxItem[]> {
    return this.read()
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(toInboxItem);
  }

  async unreadCount(): Promise<number> {
    return this.read().filter((r) => r.read_at === null).length;
  }

  async markAllRead(): Promise<void> {
    const at = this.now().toISOString();
    this.storage.setItem(this.key(), JSON.stringify(this.read().map((r) => ({ ...r, read_at: r.read_at ?? at }))));
  }
}

function sampleRows(now: Date): InboxRow[] {
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  return [
    { id: 3, kind: 'trip', title: '일정이 바뀌었어요', body: '민지님이 「강릉 가을 여행」 일정을 고쳤어요', url: '/trips', created_at: ago(12), read_at: null },
    { id: 2, kind: 'join', title: '함께하는 사람이 늘었어요', body: '민지님이 「강릉 가을 여행」에 참여했어요', url: '/trips', created_at: ago(60 * 26), read_at: null },
    { id: 1, kind: 'notice', title: '새 공지', body: '트립플로 알파 테스트를 시작해요', url: '/account/notices', created_at: ago(60 * 24 * 5), read_at: ago(60 * 24 * 4) },
  ];
}
