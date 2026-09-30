import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../auth/data/auth-store';
import { AdminAccess } from './data/admin-access';
import { requireAdmin } from './admin.routes';

function run(options: { user: { id: string } | null; admin: boolean }) {
  const check = vi.fn(async () => options.admin);
  const injector = Injector.create({
    providers: [
      {
        provide: AuthStore,
        useValue: {
          initialize: async () => undefined,
          user: signal(options.user),
          nickname: () => (options.user ? '여행테스터' : null),
        },
      },
      { provide: AdminAccess, useValue: { check } },
      { provide: Router, useValue: { createUrlTree: (commands: string[]) => ({ to: commands }) } },
    ],
  });
  return { result: runInInjectionContext(injector, () => requireAdmin()), check };
}

describe('requireAdmin', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', { getItem: () => null }));
  afterEach(() => vi.unstubAllGlobals());

  it('관리자는 들어간다', async () => {
    expect(await run({ user: { id: 'a' }, admin: true }).result).toBe(true);
  });

  it('일반 사용자는 내 정보로 돌아간다', async () => {
    expect(await run({ user: { id: 'b' }, admin: false }).result).toEqual({ to: ['/account'] });
  });

  it('로그인하지 않았으면 로그인 화면으로 가고 관리자 여부를 묻지 않는다', async () => {
    const { result, check } = run({ user: null, admin: true });
    expect(await result).toEqual({ to: ['/login'] });
    expect(check).not.toHaveBeenCalled();
  });
});
