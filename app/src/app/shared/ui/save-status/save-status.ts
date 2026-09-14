import { UiBadge } from '../badge/badge';
import { UiButton } from '../button/button';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

/** 저장 중 · 저장됨 · 저장 실패(재시도)를 구분해 보여준다. */
@Component({
  host: { class: 'inline-flex items-center' },
  selector: 'app-save-status',
  imports: [UiButton, UiBadge, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './save-status.html',
})
export class SaveStatusComponent {
  readonly state = input<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly savedAt = input<Date | null>(null);
  readonly retry = output<void>();
  readonly time = computed(() => {
    const at = this.savedAt();
    if (!at) return '';
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  });
}
