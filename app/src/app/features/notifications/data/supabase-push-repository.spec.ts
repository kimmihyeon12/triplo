import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { SwPush } from '@angular/service-worker';
import type { SupabaseClient } from '@supabase/supabase-js';
import { needsInstall } from '../model/notifications';
import { SupabasePushRepository, type PushEnvironment } from './supabase-push-repository';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';

describe('아이폰 판별', () => {
  it('아이폰·아이패드 탭은 설치가 필요하고, 설치한 앱과 다른 기기는 아니다', () => {
    expect(needsInstall(IPHONE, false, 5)).toBe(true);
    expect(needsInstall(IPHONE, true, 5)).toBe(false);
    expect(needsInstall('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', false, 5)).toBe(true);
    expect(needsInstall('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', false, 0)).toBe(false);
    expect(needsInstall(CHROME, false, 0)).toBe(false);
  });
});

function setup(options: { enabled?: boolean; permission?: NotificationPermission | null; subscribed?: boolean; rpcError?: boolean; ua?: string } = {}) {
  const unsubscribe = vi.fn(async () => true);
  const subscription = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe,
  } as unknown as PushSubscription;
  let permission = options.permission === undefined ? 'default' : options.permission;
  const swPush = {
    isEnabled: options.enabled ?? true,
    subscription: of(options.subscribed ? subscription : null),
    requestSubscription: vi.fn(async () => {
      permission = 'granted';
      return subscription;
    }),
    unsubscribe: vi.fn(async () => undefined),
  } as unknown as SwPush;
  const rpc = vi.fn(async () => ({ error: options.rpcError ? { message: 'x' } : null }));
  const invoke = vi.fn(async () => ({ data: { publicKey: 'PUBLIC' }, error: null }));
  const client = { rpc, functions: { invoke } } as unknown as SupabaseClient;
  const env: PushEnvironment = { userAgent: options.ua ?? CHROME, standalone: false, maxTouchPoints: 0, permission: () => permission };
  return { repo: new SupabasePushRepository(swPush, async () => client, env), swPush, rpc, invoke, unsubscribe };
}

describe('웹 푸시 구독', () => {
  it('상태를 가린다: 설치 필요·지원 안 함·거부·켬·끔', async () => {
    expect(await setup({ ua: IPHONE }).repo.deviceState()).toBe('install-required');
    expect(await setup({ enabled: false }).repo.deviceState()).toBe('unsupported');
    expect(await setup({ permission: null }).repo.deviceState()).toBe('unsupported');
    expect(await setup({ permission: 'denied' }).repo.deviceState()).toBe('denied');
    expect(await setup({ permission: 'granted', subscribed: true }).repo.deviceState()).toBe('on');
    expect(await setup({}).repo.deviceState()).toBe('off');
  });

  it('켜면 공개키로 구독하고 서버에 남긴다', async () => {
    const { repo, swPush, rpc, invoke } = setup();
    await repo.enable();
    expect(invoke).toHaveBeenCalledWith('push-dispatch', { method: 'GET' });
    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'PUBLIC' });
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', {
      p_endpoint: 'https://push.example/abc', p_p256dh: 'P', p_auth: 'A', p_user_agent: CHROME,
    });
  });

  it('서버에 남기지 못하면 구독을 되돌리고 알린다', async () => {
    const { repo, unsubscribe } = setup({ rpcError: true });
    await expect(repo.enable()).rejects.toThrow('알림을 켜지 못했어요');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('끄면 서버의 구독을 지우고 구독을 푼다', async () => {
    const { repo, rpc, swPush } = setup({ permission: 'granted', subscribed: true });
    await repo.disable();
    expect(rpc).toHaveBeenCalledWith('delete_push_subscription', { p_endpoint: 'https://push.example/abc' });
    expect(swPush.unsubscribe).toHaveBeenCalled();
  });
});

describe('구독 다시 맞추기(2026-10-06 공지 미수신)', () => {
  it('브라우저에 구독이 있고 권한이 있으면 서버에 다시 남긴다', async () => {
    const { repo, rpc } = setup({ permission: 'granted', subscribed: true });
    expect(await repo.resync()).toBe(true);
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', {
      p_endpoint: 'https://push.example/abc',
      p_p256dh: 'P',
      p_auth: 'A',
      p_user_agent: CHROME,
    });
  });

  it('구독이 없거나 권한이 없거나 설치 전이면 아무것도 하지 않는다', async () => {
    for (const options of [
      { permission: 'granted' as const, subscribed: false },
      { permission: 'default' as const, subscribed: true },
      { permission: 'granted' as const, subscribed: true, enabled: false },
      { permission: 'granted' as const, subscribed: true, ua: IPHONE },
    ]) {
      const { repo, rpc } = setup(options);
      expect(await repo.resync()).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it('서버에 남기지 못해도 구독을 지우거나 오류를 내지 않는다', async () => {
    const { repo, unsubscribe } = setup({ permission: 'granted', subscribed: true, rpcError: true });
    expect(await repo.resync()).toBe(false);
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});
