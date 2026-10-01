import type { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, needsInstall, type DeviceState, type NotificationSettings } from '../model/notifications';
import type { PushRepository } from './push-repository';

/** 브라우저 쪽 정보. 테스트에서 바꿔 끼운다. */
export interface PushEnvironment {
  readonly userAgent: string;
  readonly standalone: boolean;
  readonly maxTouchPoints: number;
  /** 'granted' | 'denied' | 'default', 알림을 지원하지 않으면 null */
  permission(): NotificationPermission | null;
}

/**
 * 웹 푸시 구독(2026-10-01). Angular 서비스 워커(SwPush)로 구독하고 서버 함수로 남긴다.
 * 공개키는 발송 함수(push-dispatch)의 GET으로 받는다. 비밀이 아니므로 저장소에 두지 않아도 된다.
 */
export class SupabasePushRepository implements PushRepository {
  private publicKey: string | null = null;

  constructor(
    private readonly swPush: SwPush,
    private readonly client: () => Promise<SupabaseClient>,
    private readonly env: PushEnvironment,
  ) {}

  async deviceState(): Promise<DeviceState> {
    if (needsInstall(this.env.userAgent, this.env.standalone, this.env.maxTouchPoints)) return 'install-required';
    const permission = this.env.permission();
    if (!this.swPush.isEnabled || permission === null) return 'unsupported';
    if (permission === 'denied') return 'denied';
    const subscription = await firstValueFrom(this.swPush.subscription);
    return subscription && permission === 'granted' ? 'on' : 'off';
  }

  async enable(): Promise<DeviceState> {
    const state = await this.deviceState();
    if (state !== 'off') return state;
    try {
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: await this.key() });
      const json = subscription.toJSON();
      const db = await this.client();
      const { error } = await db.rpc('save_push_subscription', {
        p_endpoint: subscription.endpoint,
        p_p256dh: json.keys?.['p256dh'] ?? '',
        p_auth: json.keys?.['auth'] ?? '',
        p_user_agent: this.env.userAgent,
      });
      if (error) {
        // 서버에 남기지 못하면 받을 수 없으니 구독을 되돌린다.
        await subscription.unsubscribe().catch(() => false);
        throw new Error('알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } catch (error) {
      // 권한을 거부하면 브라우저가 예외를 낸다. 그때는 거부 상태로 보인다.
      if (this.env.permission() === 'denied') return 'denied';
      throw error instanceof Error ? error : new Error('알림을 켜지 못했어요.');
    }
    return this.deviceState();
  }

  async disable(): Promise<DeviceState> {
    const subscription = await firstValueFrom(this.swPush.subscription);
    if (subscription) {
      const db = await this.client();
      await db.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint });
      await this.swPush.unsubscribe().catch(() => undefined);
    }
    return this.deviceState();
  }

  async settings(): Promise<NotificationSettings> {
    const db = await this.client();
    const { data, error } = await db.from('notification_settings').select('replies, notices, together').maybeSingle();
    if (error) throw new Error('알림 설정을 불러오지 못했어요.');
    return data ? (data as NotificationSettings) : DEFAULT_SETTINGS;
  }

  async saveSettings(settings: NotificationSettings): Promise<void> {
    const db = await this.client();
    const { error } = await db.rpc('save_notification_settings', {
      p_replies: settings.replies,
      p_notices: settings.notices,
      p_together: settings.together,
    });
    if (error) throw new Error('알림 설정을 저장하지 못했어요.');
  }

  private async key(): Promise<string> {
    if (this.publicKey) return this.publicKey;
    const db = await this.client();
    const { data, error } = await db.functions.invoke('push-dispatch', { method: 'GET' });
    const key = (data as { publicKey?: string } | null)?.publicKey;
    if (error || !key) throw new Error('알림 서버에 연결하지 못했어요.');
    this.publicKey = key;
    return key;
  }
}
