import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SaveStatusComponent } from '../../../../shared/ui/save-status/save-status';
import { formatPeriod } from '../../../../shared/util/dates';
import type { Trip } from '../../model/trip';

@Component({
  host: { class: 'block [margin-bottom:-4px]' },
  selector: 'app-trip-header',
  imports: [SaveStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-header.html',
})
export class TripHeader {
  readonly trip = input.required<Trip>();
  readonly saveState = input<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly savedAt = input<Date | null>(null);
  readonly retry = output<void>();
  readonly period = computed(() => formatPeriod(this.trip().startDate, this.trip().endDate));
  readonly regionPath = computed(() =>
    this.trip()
      .regions.map((r) => r.name)
      .join(' → '),
  );
}
