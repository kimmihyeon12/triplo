import { describe, expect, it, vi } from 'vitest';
import {
  createPushDispatch,
  payloadOf,
  type OutboxRow,
  type PushDeps,
  type Settings,
  type Subscription,
} from '../../../../../../supabase/functions/push-dispatch/handler';

/**
 * 발송 함수의 핸들러를 앱 테스트에서 그대로 검증한다. 외부 푸시 서버는 부르지 않는다.
 */
const sub = (user: string, endpoint: string): Subscription => ({ user_id: user, endpoint, p256dh: 'k', auth: 'a' });
const row = (partial: Partial<OutboxRow>): OutboxRow => ({
  id: 1, user_id: 'u1', broadcast: false, kind: 'reply', title: '문의에 답변이 왔어요', body: '지도가 안 떠요', url: '/account/inquiries', ...partial,
});

function setup(rows: OutboxRow[], subs: Subscription[], settings: Settings[] = [], status: (endpoint: string) => number = () => 201) {
  const deps: PushDeps = {
    publicKey: 'PUBLIC',
    cronSecret: 'secret',
    pending: vi.fn(async () => rows),
    subscriptions: vi.fn(async (ids) => subs.filter((s) => !ids || ids.includes(s.user_id))),
    settings: vi.fn(async (ids) => settings.filter((s) => !ids || ids.includes(s.user_id))),
    send: vi.fn(async (s: Subscription) => status(s.endpoint)),
    deleteSubscriptions: vi.fn(async () => {}),
    markSent: vi.fn(async () => {}),
    cleanup: vi.fn(async () => {}),
  };
  return { deps, handler: createPushDispatch(deps) };
}
const cron = (secret = 'secret') => new Request('https://x/push-dispatch', { method: 'POST', headers: { 'x-cron-secret': secret } });

describe('push-dispatch', () => {
  it('GET은 공개키만 돌려준다', async () => {
    const { handler } = setup([], []);
    expect(await (await handler(new Request('https://x/push-dispatch'))).json()).toEqual({ publicKey: 'PUBLIC' });
  });

  it('비밀 헤더가 없으면 보내지 않는다', async () => {
    const { handler, deps } = setup([row({})], [sub('u1', 'e1')]);
    expect((await handler(cron('wrong'))).status).toBe(401);
    expect(deps.pending).not.toHaveBeenCalled();
  });

  it('받는 사람의 모든 기기에 보내고 보낸 것으로 표시한다', async () => {
    const { handler, deps } = setup([row({ id: 7 })], [sub('u1', 'e1'), sub('u1', 'e2'), sub('u2', 'e3')]);
    expect(await (await handler(cron())).json()).toEqual({ sent: 2, skipped: 0 });
    expect((deps.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].endpoint)).toEqual(['e1', 'e2']);
    expect(deps.markSent).toHaveBeenCalledWith([7]);
  });

  it('설정을 끈 종류는 보내지 않지만 보낸 것으로 표시해 다시 꺼내지 않는다', async () => {
    const { handler, deps } = setup([row({ id: 3, kind: 'trip' })], [sub('u1', 'e1')], [{ user_id: 'u1', replies: true, notices: true, together: false }]);
    expect(await (await handler(cron())).json()).toEqual({ sent: 0, skipped: 1 });
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.markSent).toHaveBeenCalledWith([3]);
  });

  it('공지는 공지를 켠 모든 사람에게 보낸다', async () => {
    const { handler, deps } = setup(
      [row({ id: 9, user_id: null, broadcast: true, kind: 'notice', title: '새 공지', body: '점검 안내', url: '/account/notices' })],
      [sub('u1', 'e1'), sub('u2', 'e2'), sub('u3', 'e3')],
      [{ user_id: 'u2', replies: true, notices: false, together: true }],
    );
    await handler(cron());
    expect((deps.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].endpoint)).toEqual(['e1', 'e3']);
  });

  it('만료된 구독(404·410)은 지우고, 한 기기의 실패가 나머지를 막지 않는다', async () => {
    const { handler, deps } = setup([row({})], [sub('u1', 'gone'), sub('u1', 'boom'), sub('u1', 'ok')], [], (e) => (e === 'gone' ? 410 : e === 'boom' ? 500 : 201));
    expect(await (await handler(cron())).json()).toEqual({ sent: 1, skipped: 0 });
    expect(deps.deleteSubscriptions).toHaveBeenCalledWith(['gone']);
  });

  it('알림 모양은 서비스 워커가 눌렀을 때 그 화면을 연다', () => {
    const payload = JSON.parse(payloadOf(row({ url: '/trips/t1' })));
    expect(payload.notification).toMatchObject({
      title: '문의에 답변이 왔어요',
      body: '지도가 안 떠요',
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: '/trips/t1' } } },
    });
  });
});
