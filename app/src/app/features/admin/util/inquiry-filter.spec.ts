import { describe, expect, it } from 'vitest';
import { filterInquiries, openCount } from './inquiry-filter';
import type { AdminInquiry } from '../model/admin-support';

const q = (id: string, status: AdminInquiry['status']): AdminInquiry => ({
  id, kind: 'bug', body: 'b', status, createdAt: '2026-10-01T00:00:00Z', appVersion: 'v', userAgent: 'ua',
  replies: [], readAt: null, senderNickname: '민지',
});
const list = [q('a', 'open'), q('b', 'reading'), q('c', 'answered'), q('d', 'open')];

describe('문의 필터', () => {
  it('상태로 거르고 전체는 그대로 둔다', () => {
    expect(filterInquiries(list, 'all').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterInquiries(list, 'open').map((i) => i.id)).toEqual(['a', 'd']);
    expect(filterInquiries(list, 'answered').map((i) => i.id)).toEqual(['c']);
  });
  it('접수됨 개수를 센다', () => {
    expect(openCount(list)).toBe(2);
  });
});
