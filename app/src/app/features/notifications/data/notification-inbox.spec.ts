import { describe, expect, it } from 'vitest';
import { inboxTime, safeInboxUrl } from '../model/inbox';
import { LocalNotificationInbox, toInboxItem } from './notification-inbox';

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
};

describe('알림 시각 표기', () => {
  const now = new Date(2026, 9, 6, 14, 0);
  it('오늘은 방금·분·시간, 어제는 어제, 그 전은 월.일', () => {
    expect(inboxTime(new Date(2026, 9, 6, 13, 59, 40).toISOString(), now)).toBe('방금');
    expect(inboxTime(new Date(2026, 9, 6, 13, 48).toISOString(), now)).toBe('12분 전');
    expect(inboxTime(new Date(2026, 9, 6, 9, 0).toISOString(), now)).toBe('5시간 전');
    expect(inboxTime(new Date(2026, 9, 5, 22, 0).toISOString(), now)).toBe('어제');
    expect(inboxTime(new Date(2026, 9, 1, 9, 0).toISOString(), now)).toBe('10.01');
  });
});

describe('알림 주소', () => {
  it('앱 안 경로만 따라간다', () => {
    expect(safeInboxUrl('/trips/abc')).toBe('/trips/abc');
    expect(safeInboxUrl('https://evil.example')).toBeNull();
    expect(safeInboxUrl('//evil.example')).toBeNull();
  });
});

describe('서버 행 바꾸기', () => {
  it('읽은 시각이 있으면 읽음이다', () => {
    const row = { id: 7, kind: 'trip' as const, title: 't', body: 'b', url: '/trips', created_at: '2026-10-06T00:00:00Z', read_at: null };
    expect(toInboxItem(row)).toMatchObject({ id: '7', read: false, createdAt: '2026-10-06T00:00:00Z' });
    expect(toInboxItem({ ...row, read_at: '2026-10-06T01:00:00Z' }).read).toBe(true);
  });
});

describe('기기 알림 내역(테스트 앱)', () => {
  const now = () => new Date('2026-10-06T05:00:00Z');

  it('처음 열면 예시를 최근 것부터 보이고 안 읽은 수를 센다', async () => {
    const store = memory();
    const inbox = new LocalNotificationInbox(store, () => 'k', now);
    const list = await inbox.list();
    expect(list.map((i) => i.kind)).toEqual(['trip', 'join', 'notice']);
    expect(await inbox.unreadCount()).toBe(2);
  });

  it('모두 읽음으로 하면 안 읽은 수가 0이고 다시 열어도 남는다', async () => {
    const store = memory();
    await new LocalNotificationInbox(store, () => 'k', now).markAllRead();
    const again = new LocalNotificationInbox(store, () => 'k', now);
    expect(await again.unreadCount()).toBe(0);
    expect((await again.list()).every((i) => i.read)).toBe(true);
  });

  it('계정마다 따로 남긴다', async () => {
    const store = memory();
    await new LocalNotificationInbox(store, () => 'a', now).markAllRead();
    expect(await new LocalNotificationInbox(store, () => 'b', now).unreadCount()).toBe(2);
  });
});
