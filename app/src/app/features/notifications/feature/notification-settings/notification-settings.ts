import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { ToastService } from '../../../../core/toast-service';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { UiSwitch } from '../../../../shared/ui/switch/switch';
import { PUSH_REPOSITORY } from '../../data/push-repository';
import { DEFAULT_SETTINGS, type DeviceState, type NotificationSettings } from '../../model/notifications';

/**
 * 알림 설정(2026-10-01). 이 기기에서 받기는 기기마다, 받을 종류는 계정마다 정한다.
 * 스위치는 누르는 즉시 반영한다(DESIGN.md 스위치 규칙).
 */
@Component({
  selector: 'app-notification-settings',
  imports: [RouterLink, IconComponent, UiSpinner, UiSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-settings.html',
})
export class NotificationSettingsPage {
  private readonly push = inject(PUSH_REPOSITORY);
  private readonly toast = inject(ToastService);

  readonly device = signal<DeviceState | null>(null);
  readonly settings = signal<NotificationSettings>(DEFAULT_SETTINGS);
  readonly busy = signal(false);

  readonly kinds: readonly { key: keyof NotificationSettings; label: string; hint: string }[] = [
    { key: 'replies', label: '문의 답변', hint: '보낸 문의에 답변이 오면 알려요' },
    { key: 'notices', label: '새 공지', hint: '새 공지가 올라오면 알려요' },
    { key: 'together', label: '함께 편집 소식', hint: '함께하는 사람이 참여하거나 일정·가계부를 고치면 알려요' },
  ];

  constructor() {
    inject(PageBar).set({ title: '알림', back: ['/account'], action: null });
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [device, settings] = await Promise.all([this.push.deviceState(), this.push.settings()]);
      this.device.set(device);
      this.settings.set(settings);
    } catch (error) {
      this.device.set('off');
      this.toast.error(error instanceof Error ? error.message : '알림 설정을 불러오지 못했어요.');
    }
  }

  async toggleDevice(): Promise<void> {
    const state = this.device();
    if (this.busy() || (state !== 'on' && state !== 'off')) return;
    this.busy.set(true);
    try {
      this.device.set(state === 'on' ? await this.push.disable() : await this.push.enable());
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : '알림을 바꾸지 못했어요.');
    } finally {
      this.busy.set(false);
    }
  }

  async toggleKind(key: keyof NotificationSettings): Promise<void> {
    if (this.busy()) return;
    const before = this.settings();
    const next = { ...before, [key]: !before[key] };
    // 누르는 즉시 바꿔 보이고, 저장에 실패하면 되돌린다.
    this.settings.set(next);
    try {
      await this.push.saveSettings(next);
    } catch (error) {
      this.settings.set(before);
      this.toast.error(error instanceof Error ? error.message : '알림 설정을 저장하지 못했어요.');
    }
  }
}
