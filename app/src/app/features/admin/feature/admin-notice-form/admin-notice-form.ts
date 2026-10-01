import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationHistory } from '../../../../core/navigation-history';
import { PageBar } from '../../../../core/page-bar';
import { ToastService } from '../../../../core/toast-service';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { UiField } from '../../../../shared/ui/field/field';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { AdminSupport, isAdminDenied, isAdminMissing } from '../../data/admin-support';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX } from '../../model/admin-support';
import { adminExit } from '../admin-exit';
import { noticeBodyError, noticeFormError, noticeTitleError } from '../../util/admin-form';

/**
 * 공지 작성·수정. 앱의 다른 편집 폼처럼 저장하면 목록으로 돌아가고, 기록에서
 * 폼 자리를 지워 뒤로 가도 폼이 다시 나오지 않는다. 발행 여부는 체크박스로 정해
 * 저장할 때 함께 반영한다(고친 내용이 저장되지 않은 채 발행되는 일이 없다).
 * 삭제는 맨 아래에서 한 번 더 확인한다.
 */
@Component({
  selector: 'app-admin-notice-form',
  imports: [RouterLink, UiActionBar, UiButton, UiCheckbox, UiField, IconComponent, UiInput, UiNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-notice-form.html',
})
export class AdminNoticeForm {
  private readonly support = inject(AdminSupport);
  private readonly history = inject(NavigationHistory);
  private readonly toast = inject(ToastService);
  private readonly exit = adminExit();

  /** 라우트의 :id. 새 공지면 없다. */
  readonly id = input<string | undefined>();
  readonly titleMax = NOTICE_TITLE_MAX;
  readonly bodyMax = NOTICE_BODY_MAX;

  readonly title = signal('');
  readonly body = signal('');
  readonly published = signal(false);
  /** 서버에 있는 발행 상태. 저장할 때 바뀌었으면 발행 함수를 부른다. */
  private readonly wasPublished = signal(false);
  readonly titleTouched = signal(false);
  readonly bodyTouched = signal(false);
  readonly busy = signal(false);
  readonly confirmDelete = signal(false);
  readonly error = signal<string | null>(null);

  readonly titleError = computed(() => (this.titleTouched() ? noticeTitleError(this.title()) : null));
  readonly bodyError = computed(() => (this.bodyTouched() ? noticeBodyError(this.body()) : null));
  readonly canSave = computed(() => !this.busy() && !noticeFormError(this.title(), this.body()));
  readonly isNew = computed(() => !this.id());

  constructor() {
    inject(PageBar).set({ title: '공지', back: ['/admin/notices'], action: null });
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    await this.run(async () => {
      const notice = await this.support.notice(id);
      if (!notice) {
        await this.exit.missing('이미 지워진 공지예요.', '/admin/notices');
        return;
      }
      this.title.set(notice.title);
      this.body.set(notice.body);
      this.published.set(notice.status === 'published');
      this.wasPublished.set(notice.status === 'published');
    });
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    this.titleTouched.set(true);
    this.bodyTouched.set(true);
    if (!this.canSave()) return;
    await this.run(async () => {
      const id = await this.support.saveNotice(this.id() ?? null, this.title(), this.body());
      const publish = this.published();
      if (publish !== this.wasPublished()) await this.support.setPublished(id, publish);
      this.toast.success(
        publish === this.wasPublished() ? '저장했어요.' : publish ? '발행했어요.' : '발행을 취소했어요.',
      );
      this.history.leave(['/admin/notices']);
    });
  }

  async remove(): Promise<void> {
    const id = this.id();
    if (!id || this.busy()) return;
    await this.run(async () => {
      await this.support.deleteNotice(id);
      this.toast.success('공지를 지웠어요.');
      this.history.leave(['/admin/notices']);
    });
  }

  /** 호출 하나를 감싼다. 권한이 사라지면 내 정보로, 지워진 공지면 목록으로, 그 밖의 오류는 화면에 보인다. */
  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
    } catch (error) {
      if (isAdminDenied(error)) {
        await this.exit.denied();
        return;
      }
      if (isAdminMissing(error)) {
        await this.exit.missing('이미 지워진 공지예요.', '/admin/notices');
        return;
      }
      this.error.set(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      this.busy.set(false);
    }
  }
}
