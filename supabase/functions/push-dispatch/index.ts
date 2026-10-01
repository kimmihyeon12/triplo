import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import webpush from 'npm:web-push@3.6.7';
import { createPushDispatch, type Settings, type Subscription } from './handler.ts';

// 비밀값은 Edge Function 환경에만 있다. 브라우저에는 공개키만 간다.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
if (publicKey && privateKey) webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@triplo.app', publicKey, privateKey);

Deno.serve(
  createPushDispatch({
    publicKey,
    cronSecret: Deno.env.get('PUSH_CRON_SECRET') ?? '',
    async pending(limit) {
      const { data, error } = await admin
        .from('notification_outbox')
        .select('id, user_id, broadcast, kind, title, body, url')
        .is('sent_at', null)
        .order('created_at')
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    async subscriptions(userIds) {
      let query = admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth');
      if (userIds) query = query.in('user_id', userIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
    async settings(userIds) {
      let query = admin.from('notification_settings').select('user_id, replies, notices, together');
      if (userIds) query = query.in('user_id', userIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Settings[];
    },
    async send(sub, payload) {
      try {
        const result = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        return result.statusCode;
      } catch (error) {
        // web-push는 2xx가 아니면 던진다. 상태만 넘겨 만료 구독을 가린다.
        const status = (error as { statusCode?: number }).statusCode;
        if (typeof status === 'number') return status;
        throw error;
      }
    },
    async deleteSubscriptions(endpoints) {
      await admin.from('push_subscriptions').delete().in('endpoint', endpoints);
    },
    async markSent(ids) {
      await admin.from('notification_outbox').update({ sent_at: new Date().toISOString() }).in('id', ids);
    },
    async cleanup() {
      // 보낸 지 7일 지난 기록은 지운다.
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from('notification_outbox').delete().lt('sent_at', week);
    },
  }),
);
