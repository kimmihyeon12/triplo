import { describe, expect, it, vi } from 'vitest';
import { SupabaseSupportRepository } from './supabase-support-repository';
import type { SupportDataClient } from './support-data-client';
import type { InquiryRow, NoticeRow } from './support-rows';

const notice = (id: string, published: string): NoticeRow => ({
  id, title: id, body: '본문', status: 'published', generated: false, release_tag: '', created_at: published, published_at: published,
});
const inquiry = (id: string, extra: Partial<InquiryRow> = {}): InquiryRow => ({
  id, user_id: 'u', sender_nickname: '민지', kind: 'bug', body: '안 돼요', status: 'open', app_version: 'v', user_agent: 'ua',
  answer_read_at: null, created_at: '2026-10-01T00:00:00Z', inquiry_replies: [], ...extra,
});
function fake(over: Partial<SupportDataClient> = {}): SupportDataClient {
  return {
    publishedNotices: async () => [notice('n2', '2026-10-02T00:00:00Z'), notice('n1', '2026-10-01T00:00:00Z')],
    readNoticeIds: async () => ['n1'],
    myInquiries: async () => [],
    call: vi.fn(async () => 'new-id'),
    ...over,
  };
}
const repo = (client: SupportDataClient) => new SupabaseSupportRepository(client, 'v0.10.3', () => 'test-agent');

describe('SupabaseSupportRepository', () => {
  it('운영자에게 전달한다', () => {
    expect(repo(fake()).delivers).toBe(true);
  });
  it('안 읽은 공지를 읽음 기록으로 센다', async () => {
    const r = repo(fake());
    expect(await r.unreadNoticeIds()).toEqual(['n2']);
    expect(await r.unreadNoticeCount()).toBe(1);
  });
  it('공지를 읽으면 서버 함수를 부른다', async () => {
    const client = fake();
    await repo(client).markNoticesRead();
    expect(client.call).toHaveBeenCalledWith('mark_notices_read', undefined);
  });
  it('문의를 앱 버전·기기 정보와 함께 보내고 방금 만든 문의를 돌려준다', async () => {
    const client = fake({ myInquiries: async () => [inquiry('new-id')] });
    const sent = await repo(client).sendInquiry('bug', '안 돼요');
    expect(client.call).toHaveBeenCalledWith('send_inquiry', { p_kind: 'bug', p_body: '안 돼요', p_app_version: 'v0.10.3', p_user_agent: 'test-agent' });
    expect(sent).toMatchObject({ id: 'new-id', kind: 'bug', status: 'open' });
  });
  it('답변이 확인 뒤에 새로 달리면 다시 새 답변으로 센다', async () => {
    const replied = (at: string) => ({ id: at, body: '답', author_role: 'admin' as const, created_at: at });
    const client = fake({ myInquiries: async () => [
      inquiry('a', { status: 'answered', inquiry_replies: [replied('2026-10-01T01:00:00Z')], answer_read_at: '2026-10-01T02:00:00Z' }),
      inquiry('b', { status: 'answered', inquiry_replies: [replied('2026-10-01T01:00:00Z'), replied('2026-10-01T03:00:00Z')], answer_read_at: '2026-10-01T02:00:00Z' }),
      inquiry('c', { status: 'answered', inquiry_replies: [replied('2026-10-01T01:00:00Z')] }),
    ] });
    const r = repo(client);
    expect(await r.unansweredReadCount()).toBe(2);
    const list = await r.inquiries();
    expect(list.find((i) => i.id === 'a')!.readAt).toBe('2026-10-01T02:00:00Z');
    expect(list.find((i) => i.id === 'b')!.readAt).toBeNull();
  });
  it('문의를 최신순으로 돌려주고 답변을 시간순으로 붙인다', async () => {
    const client = fake({ myInquiries: async () => [
      inquiry('old', { created_at: '2026-09-30T00:00:00Z' }),
      inquiry('new', { created_at: '2026-10-01T00:00:00Z', inquiry_replies: [
        { id: 'r2', body: '둘', author_role: 'admin', created_at: '2026-10-01T02:00:00Z' },
        { id: 'r1', body: '하나', author_role: 'admin', created_at: '2026-10-01T01:00:00Z' },
      ] }),
    ] });
    const list = await repo(client).inquiries();
    expect(list.map((i) => i.id)).toEqual(['new', 'old']);
    expect(list[0]!.replies.map((r) => r.body)).toEqual(['하나', '둘']);
  });
  it('보내기에 성공했으면 다시 읽기가 실패해도 오류를 내지 않는다(같은 문의를 두 번 보내지 않게)', async () => {
    const client = fake({ myInquiries: async () => { throw new Error('offline'); } });
    const sent = await repo(client).sendInquiry('idea', '제안');
    expect(sent).toMatchObject({ id: 'new-id', kind: 'idea', body: '제안', status: 'open', replies: [] });
  });
  it('답변 시각을 형식이 달라도 시각으로 비교한다', async () => {
    const replied = { id: 'r', body: '답', author_role: 'admin' as const, created_at: '2026-10-01T01:00:00.5+00:00' };
    const client = fake({ myInquiries: async () => [
      inquiry('a', { status: 'answered', inquiry_replies: [replied], answer_read_at: '2026-10-01T01:00:00Z' }),
    ] });
    expect(await repo(client).unansweredReadCount()).toBe(1);
  });
  it('읽음은 화면에 보인 마지막 답변 시각까지로 기록한다(그 뒤 답변은 새 답변으로 남게)', async () => {
    const client = fake();
    await repo(client).markInquiryRead('a', '2026-10-01T01:00:00.123456+00:00');
    expect(client.call).toHaveBeenCalledWith('mark_inquiry_read', { p_id: 'a', p_seen_at: '2026-10-01T01:00:00.123456+00:00' });
  });
});
