/**
 * 알림 발송(2026-10-01). pg_cron이 1분마다 부른다. outbox에 쌓인 알림을 받는 사람의
 * 기기(구독)마다 웹 푸시로 보낸다. 설계: docs/superpowers/specs/2026-10-01-push-notifications-design.md
 *
 * GET은 앱이 구독할 때 쓰는 공개키를 돌려준다(공개키는 비밀이 아니다).
 * POST는 cron만 부른다. 비밀 헤더가 맞지 않으면 거절한다.
 */

export type OutboxKind = 'reply' | 'notice' | 'join' | 'trip' | 'ledger';

export interface OutboxRow {
  id: number;
  user_id: string | null;
  broadcast: boolean;
  kind: OutboxKind;
  title: string;
  body: string;
  url: string;
}

export interface Subscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Settings {
  user_id: string;
  replies: boolean;
  notices: boolean;
  together: boolean;
}

export interface PushDeps {
  publicKey: string;
  cronSecret: string;
  pending(limit: number): Promise<OutboxRow[]>;
  /** 받는 사람들의 구독. userIds가 null이면 모든 구독(공지). */
  subscriptions(userIds: string[] | null): Promise<Subscription[]>;
  settings(userIds: string[] | null): Promise<Settings[]>;
  /** 웹 푸시 하나를 보내고 응답 상태를 돌려준다. */
  send(sub: Subscription, payload: string): Promise<number>;
  deleteSubscriptions(endpoints: string[]): Promise<void>;
  markSent(ids: number[]): Promise<void>;
  cleanup(): Promise<void>;
}

const BATCH = 200;

/** 종류별로 어느 설정을 보는지. */
const SETTING: Record<OutboxKind, keyof Omit<Settings, 'user_id'>> = {
  reply: 'replies',
  notice: 'notices',
  join: 'together',
  trip: 'together',
  ledger: 'together',
};

/** Angular 서비스 워커가 알아보는 모양. 누르면 그 주소를 열거나 열린 창으로 옮긴다. */
export function payloadOf(row: Pick<OutboxRow, 'title' | 'body' | 'url' | 'kind'>): string {
  return JSON.stringify({
    notification: {
      title: row.title,
      body: row.body,
      icon: '/icons/notification-192.png',
      badge: '/icons/notification-badge-96.png',
      tag: row.kind,
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: row.url } } },
    },
  });
}

export function createPushDispatch(deps: PushDeps) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET') return reply(200, { publicKey: deps.publicKey });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    if (!deps.cronSecret || request.headers.get('x-cron-secret') !== deps.cronSecret)
      return reply(401, { error: 'unauthorized' });

    const rows = await deps.pending(BATCH);
    if (!rows.length) {
      await deps.cleanup();
      return reply(200, { sent: 0, skipped: 0 });
    }
    const hasBroadcast = rows.some((r) => r.broadcast);
    const userIds = [...new Set(rows.flatMap((r) => (r.user_id ? [r.user_id] : [])))];
    const [subs, settings] = await Promise.all([
      deps.subscriptions(hasBroadcast ? null : userIds),
      deps.settings(hasBroadcast ? null : userIds),
    ]);
    const settingOf = new Map(settings.map((s) => [s.user_id, s] as const));
    // 설정이 없으면 모두 켠 것으로 본다(기본값).
    const allows = (userId: string, kind: OutboxKind) => settingOf.get(userId)?.[SETTING[kind]] ?? true;

    let sent = 0;
    let skipped = 0;
    const gone = new Set<string>();
    for (const row of rows) {
      const targets = subs.filter((s) => (row.broadcast || s.user_id === row.user_id) && allows(s.user_id, row.kind));
      if (!targets.length) skipped++;
      const payload = payloadOf(row);
      for (const sub of targets) {
        if (gone.has(sub.endpoint)) continue;
        try {
          const status = await deps.send(sub, payload);
          // 404·410은 구독이 끝났다는 뜻이다(앱 삭제, 권한 회수). 다시 보내지 않게 지운다.
          if (status === 404 || status === 410) gone.add(sub.endpoint);
          else if (status >= 200 && status < 300) sent++;
        } catch {
          // 한 기기의 실패가 나머지를 막지 않게 한다. 다시 보내지는 않는다(중복 알림보다 낫다).
        }
      }
    }
    if (gone.size) await deps.deleteSubscriptions([...gone]);
    await deps.markSent(rows.map((r) => r.id));
    await deps.cleanup();
    return reply(200, { sent, skipped });
  };
}
