import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP_VERSION } from '../../../../core/version';
import { PageBar } from '../../../../core/page-bar';
import { AuthStore } from '../../data/auth-store';
import { normalizeNickname } from '../../util/nickname';
import { SUPPORT_REPOSITORY } from '../../../support/data/support-repository';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField } from '../../../../shared/ui/field/field';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { UiSwitch } from '../../../../shared/ui/switch/switch';
import { ErrorToast } from '../../../../shared/ui/error-toast/error-toast';
import { IconComponent } from '../../../../shared/ui/icon/icon';

/**
 * 내 정보 화면.
 *
 * 로그인 화면과 한 컴포넌트를 나눠 쓰던 것을 떼어냈다. 한 파일이 두 화면을
 * 맡으면 어느 쪽 코드인지 읽기 어렵고, 닉네임 편집처럼 이 화면에만 필요한
 * 상태를 넣을 자리가 없다.
 *
 * E2E가 쓰는 표시(login-account·logout·delete-account·account-deleted)는
 * 이름을 그대로 옮겼다. 화면을 나눈 것이지 동작을 바꾼 것이 아니다.
 */
@Component({
  selector: 'app-account',
  imports: [
    UiButton,
    UiField,
    UiInput,
    UiNotice,
    UiSpinner,
    UiSwitch,
    ErrorToast,
    IconComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.html',
})
export class AccountPage {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly support = inject(SUPPORT_REPOSITORY);

  /** 배포된 화면이 어느 것인지 알리는 버전. 빌드가 만든다. */
  readonly version = APP_VERSION;

  /**
   * 화면만 확인하는 중인지.
   *
   * 가드와 같은 조건을 써야 한다. 가드는 통과시켰는데 이 화면이 다시
   * 내보내면 열자마자 로그인으로 튕긴다.
   */
  private readonly previewing =
    this.auth.designPreview ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tc.preview.v1') === '1');

  /**
   * 디자인 미리보기에서 보여줄 가짜 계정.
   *
   * 실제 세션을 만들지 않는다. 기획안 33절에 따라 화면 확인 용도로만 쓴다.
   */
  readonly displayedUser = computed(
    () =>
      this.auth.user() ??
      (this.previewing
        ? { email: '디자인 미리보기', app_metadata: { provider: 'google' } }
        : null),
  );

  readonly settling = computed(() => this.auth.loading() || this.auth.resolvingCallback());

  /** 닉네임 편집 중인지. 연필을 누르면 열린다. */
  readonly editing = signal(false);
  readonly draftNickname = signal('');

  /**
   * 저장 버튼을 누를 수 있는지.
   *
   * 값이 그대로면 누를 이유가 없고, 길이가 맞지 않으면 어차피 저장에서
   * 걸린다. 눌러 보고 나서 오류를 보는 것보다 미리 막는 편이 낫다.
   */
  readonly canSaveNickname = computed(() => {
    const next = normalizeNickname(this.draftNickname());
    return !!next && next !== this.auth.nickname() && !this.auth.busy();
  });

  readonly unreadNotices = signal(0);
  readonly unreadReplies = signal(0);

  /** 알림 설정. 서버에 보내기 전까지는 기기에만 둔다. */
  readonly notificationsOn = signal(true);

  /** 회원탈퇴 확인 영역이 열려 있는지. */
  readonly leaving = signal(false);
  readonly confirmation = signal('');

  constructor() {
    inject(PageBar).set({ title: '내 정보', back: ['/trips'], action: null });

    effect(() => {
      // 로그아웃하면 이 화면에 있을 이유가 없다. 다른 탭에서 끊긴 경우도 같다.
      if (this.previewing) return;
      if (this.auth.loading() || this.auth.resolvingCallback()) return;
      // 탈퇴한 직후에는 내보내지 않는다. 결과를 읽을 새도 없이 화면이
      // 바뀌면 정말 지워졌는지 알 수 없다.
      if (this.auth.deleted()) return;
      if (!this.auth.user()) void this.router.navigateByUrl('/login', { replaceUrl: true });
    });

    void this.auth.initialize();
    void this.loadCounts();
  }

  private async loadCounts(): Promise<void> {
    const [notices, replies] = await Promise.all([
      this.support.unreadNoticeCount(),
      this.support.unansweredReadCount(),
    ]);
    this.unreadNotices.set(notices);
    this.unreadReplies.set(replies);
  }

  startEdit(): void {
    this.draftNickname.set(this.auth.nickname() ?? '');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.auth.clearError();
  }

  async saveNickname(event: Event): Promise<void> {
    event.preventDefault();
    const saved = await this.auth.saveNickname(this.draftNickname());
    // 실패하면 입력을 남긴다. 다시 치게 하지 않는다.
    if (saved) this.editing.set(false);
  }

  toggleNotifications(): void {
    this.notificationsOn.update((on) => !on);
  }

  toggleLeaving(): void {
    // 닫을 때 입력을 비운다. 다시 열었을 때 '탈퇴'가 남아 있으면 한 번만
    // 더 눌러도 지워진다.
    this.leaving.update((open) => {
      if (open) this.confirmation.set('');
      return !open;
    });
  }

  reload(): void {
    location.reload();
  }
}
