import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../auth/data/auth-store';
import { AdminAccess } from './admin-access';

function setup(rpc: () => Promise<unknown>) {
  const user = signal<{ id: string } | null>({ id: 'user-a' });
  const auth = {
    user,
    designPreview: false,
    initialize: vi.fn(async () => undefined),
    callRpc: vi.fn(rpc),
  };
  const injector = Injector.create({
    providers: [{ provide: AuthStore, useValue: auth }, AdminAccess],
  });
  const access = runInInjectionContext(injector, () => injector.get(AdminAccess));
  return { access, auth, user };
}

describe('AdminAccess', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('서버가 true를 주면 관리자다', async () => {
    const { access, auth } = setup(async () => true);
    expect(await access.check()).toBe(true);
    expect(access.isAdmin()).toBe(true);
    expect(auth.callRpc).toHaveBeenCalledWith('is_admin');
  });

  it('서버가 false를 주면 관리자가 아니다', async () => {
    const { access } = setup(async () => false);
    expect(await access.check()).toBe(false);
    expect(access.isAdmin()).toBe(false);
  });

  it('로그인하지 않았으면 서버에 묻지 않는다', async () => {
    const { access, auth, user } = setup(async () => true);
    user.set(null);
    expect(await access.check()).toBe(false);
    expect(auth.callRpc).not.toHaveBeenCalled();
  });

  it('같은 사용자는 한 번만 묻고, 동시에 불러도 요청을 공유한다', async () => {
    const { access, auth } = setup(async () => true);
    await Promise.all([access.check(), access.check()]);
    await access.check();
    expect(auth.callRpc).toHaveBeenCalledTimes(1);
  });

  it('사용자가 바뀌면 앞 사용자의 결과를 쓰지 않는다', async () => {
    const { access, auth, user } = setup(async () => true);
    await access.check();
    auth.callRpc.mockImplementation(async () => false);
    user.set({ id: 'user-b' });
    expect(access.isAdmin()).toBe(false);
    expect(await access.check()).toBe(false);
    expect(auth.callRpc).toHaveBeenCalledTimes(2);
  });

  it('조회가 실패하면 관리자가 아니고, 다음 확인 때 다시 묻는다', async () => {
    const { access, auth } = setup(async () => {
      throw new Error('rpc_failed');
    });
    expect(await access.check()).toBe(false);
    expect(access.isAdmin()).toBe(false);
    auth.callRpc.mockImplementation(async () => true);
    expect(await access.check()).toBe(true);
    expect(auth.callRpc).toHaveBeenCalledTimes(2);
  });

  it('true가 아닌 값은 관리자로 보지 않는다', async () => {
    const { access } = setup(async () => 'true');
    expect(await access.check()).toBe(false);
  });

  it('디자인 미리보기에서는 서버에 묻지 않고 관리자 화면을 보여준다', async () => {
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => (key === 'tc.preview.v1' ? '1' : null) });
    const { access, auth, user } = setup(async () => false);
    user.set(null);
    expect(await access.check()).toBe(true);
    expect(access.isAdmin()).toBe(true);
    expect(auth.callRpc).not.toHaveBeenCalled();
  });
});
