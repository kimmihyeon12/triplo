import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';

/**
 * 지금 로그인한 사람이 관리자인지 서버에 묻고 기억한다.
 *
 * 판별은 서버의 is_admin()이 한다. 화면이 이 값을 쓰는 것은 메뉴를 가리고
 * 길을 막는 편의일 뿐이며, 실제 데이터는 서버 규칙이 지킨다.
 *
 * 결과는 사용자 ID와 함께 둔다. 로그아웃 뒤 다른 계정으로 들어왔을 때
 * 앞 계정의 결과가 남아 메뉴가 보이면 안 된다. 실패는 기억하지 않는다.
 * 잠깐 끊긴 것 때문에 새로고침 전까지 관리자가 들어가지 못하면 안 된다.
 */
@Injectable({ providedIn: 'root' })
export class AdminAccess {
  private readonly auth = inject(AuthStore);
  private readonly known = signal<{ userId: string; admin: boolean } | null>(null);
  private pending: { userId: string; result: Promise<boolean> } | null = null;

  /**
   * 디자인 미리보기인지. 가짜 계정이라 서버에 물을 수 없고, 관리자 화면에는
   * 아직 서버 데이터가 없으므로 화면 확인용으로 열어 둔다. 조건은 로그인
   * 가드와 같아야 한다.
   */
  private readonly previewing =
    this.auth.designPreview ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tc.preview.v1') === '1');

  readonly isAdmin = computed(() => {
    if (this.previewing) return true;
    const known = this.known();
    return !!known && known.admin && known.userId === this.auth.user()?.id;
  });

  async check(): Promise<boolean> {
    if (this.previewing) return true;
    await this.auth.initialize();
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const known = this.known();
    if (known?.userId === userId) return known.admin;
    if (this.pending?.userId !== userId) {
      this.pending = { userId, result: this.ask(userId) };
    }
    return this.pending.result;
  }

  private async ask(userId: string): Promise<boolean> {
    try {
      const admin = (await this.auth.callRpc<unknown>('is_admin')) === true;
      this.known.set({ userId, admin });
      return admin;
    } catch {
      return false;
    } finally {
      if (this.pending?.userId === userId) this.pending = null;
    }
  }
}
