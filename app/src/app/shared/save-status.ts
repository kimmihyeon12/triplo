import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TripStore } from '../data/trip-store';
import { IconComponent } from './icon';

/** 저장 중 · 저장됨 · 저장 실패(재시도)를 구분해 보여준다. */
@Component({
  selector: 'app-save-status',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (store.saveState()) {
      @case ('saving') {
        <span class="cell cell--ghost" role="status" data-testid="save-status" data-state="saving">저장 중…</span>
      }
      @case ('saved') {
        <span class="cell cell--accent" role="status" data-testid="save-status" data-state="saved">
          <app-icon name="check" [size]="14" />
          기기에 저장됨 · {{ time() }}
        </span>
      }
      @case ('error') {
        <span class="row" role="alert" data-testid="save-status" data-state="error">
          <span class="cell cell--danger"><app-icon name="alert" [size]="14" /> 저장 실패 · 입력은 유지됨</span>
          <button type="button" class="btn btn--sm btn--danger" (click)="store.retrySave()" data-testid="retry-save">
            <app-icon name="refresh" [size]="14" /> 다시 저장
          </button>
        </span>
      }
      @default {
        <span class="cell cell--ghost" data-testid="save-status" data-state="idle">기기 저장본</span>
      }
    }
  `,
  styles: [':host{display:inline-flex;align-items:center}'],
})
export class SaveStatusComponent {
  readonly store = inject(TripStore);
  readonly time = computed(() => {
    const at = this.store.lastSavedAt();
    if (!at) return '';
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  });
}
