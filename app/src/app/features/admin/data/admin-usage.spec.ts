import '@angular/compiler';
import { Injector } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_SUPPORT_CLIENT, isAdminDenied } from './admin-support';
import { AdminUsage } from './admin-usage';
import { SupportError } from '../../support/data/support-data-client';

const SUMMARY = {
  measuredAt: '2026-10-07T06:00:00Z',
  gemini: { dayStart: '2026-10-07T07:00:00Z', dayRequests: 3, dayFailed: 0, last24hRequests: 3, monthSince: null, month: [] },
  supabase: { dbBytes: 1, storageBytes: 0, activeUsers30d: 1 },
};

function setup(call: (fn: string, args: Record<string, unknown>) => Promise<unknown>): AdminUsage {
  const injector = Injector.create({
    providers: [{ provide: ADMIN_SUPPORT_CLIENT, useValue: { call } }, AdminUsage],
  });
  return injector.get(AdminUsage);
}

describe('AdminUsage', () => {
  it('admin_usage_summary를 불러 검사한 요약을 돌려준다', async () => {
    const call = vi.fn(async () => SUMMARY);
    expect((await setup(call).summary()).gemini.dayRequests).toBe(3);
    expect(call).toHaveBeenCalledWith('admin_usage_summary', {});
  });
  it('관리자 권한이 없으면 서버 거절을 그대로 올린다', async () => {
    const usage = setup(async () => { throw new SupportError('관리자만', '42501'); });
    await expect(usage.summary()).rejects.toSatisfy(isAdminDenied);
  });
  it('형식이 깨진 응답은 오류다', async () => {
    await expect(setup(async () => ({})).summary()).rejects.toThrow();
  });
});
