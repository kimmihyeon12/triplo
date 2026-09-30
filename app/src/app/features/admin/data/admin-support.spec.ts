import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_SUPPORT_CLIENT, AdminSupport, isAdminDenied, type AdminSupportClient } from './admin-support';
import { SupportError, toSupportError } from '../../support/data/support-data-client';
import type { InquiryRow, NoticeRow } from '../../support/data/support-rows';

const n = (id: string, status: 'draft' | 'published'): NoticeRow => ({
  id, title: id, body: 'b', status, generated: false, release_tag: '', created_at: '2026-10-01T00:00:00Z',
  published_at: status === 'published' ? '2026-10-01T00:00:00Z' : null,
});
const q = (id: string, status: InquiryRow['status'], created: string): InquiryRow => ({
  id, user_id: 'u', sender_nickname: '민지', kind: 'bug', body: 'b', status, app_version: 'v', user_agent: 'ua',
  answer_read_at: null, created_at: created, inquiry_replies: [],
});

function setup(client: Partial<AdminSupportClient> = {}): { support: AdminSupport; call: ReturnType<typeof vi.fn> } {
  const call = vi.fn(async () => 'id-1');
  const injector = Injector.create({
    providers: [
      { provide: ADMIN_SUPPORT_CLIENT, useValue: { notices: async () => [n('d', 'draft'), n('p', 'published')], inquiries: async () => [], call, ...client } },
      AdminSupport,
    ],
  });
  return { support: runInInjectionContext(injector, () => injector.get(AdminSupport)), call };
}

describe('AdminSupport', () => {
  it('초안까지 공지를 돌려준다', async () => {
    expect((await setup().support.notices()).map((x) => x.status)).toEqual(['draft', 'published']);
  });
  it('공지 저장·발행·삭제는 관리자 함수를 부른다', async () => {
    const { support, call } = setup();
    expect(await support.saveNotice(null, ' 제목 ', ' 본문 ')).toBe('id-1');
    await support.setPublished('p', false);
    await support.deleteNotice('p');
    expect(call.mock.calls).toEqual([
      ['admin_save_notice', { p_id: null, p_title: '제목', p_body: '본문' }],
      ['admin_set_notice_published', { p_id: 'p', p_published: false }],
      ['admin_delete_notice', { p_id: 'p' }],
    ]);
  });
  it('문의는 접수됨을 먼저, 그다음 최신순으로 보여 주고 닉네임을 붙인다', async () => {
    const { support } = setup({
      inquiries: async () => [
        q('answered', 'answered', '2026-10-03T00:00:00Z'),
        q('open-old', 'open', '2026-10-01T00:00:00Z'),
        q('open-new', 'open', '2026-10-02T00:00:00Z'),
      ],
    });
    const list = await support.inquiries();
    expect(list.map((i) => i.id)).toEqual(['open-new', 'open-old', 'answered']);
    expect(list[0]!.senderNickname).toBe('민지');
  });
  it('답변과 상태 변경은 관리자 함수를 부른다', async () => {
    const { support, call } = setup();
    await support.reply('q1', '  확인했어요 ');
    await support.setStatus('q1', 'reading');
    expect(call.mock.calls).toEqual([
      ['admin_reply_inquiry', { p_id: 'q1', p_body: '확인했어요' }],
      ['admin_set_inquiry_status', { p_id: 'q1', p_status: 'reading' }],
    ]);
  });
  it('권한이 사라진 오류를 가려낸다', () => {
    expect(isAdminDenied(toSupportError({ code: '42501' }))).toBe(true);
    expect(isAdminDenied(toSupportError({ code: 'P0400' }))).toBe(false);
    expect(isAdminDenied(new SupportError('x'))).toBe(false);
  });
});
