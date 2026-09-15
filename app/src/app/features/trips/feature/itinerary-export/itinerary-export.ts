import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiField } from '../../../../shared/ui/field/field';
import { ErrorToast } from '../../../../shared/ui/error-toast/error-toast';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { TripEditorStore } from '../../data/trip-editor-store';
import { ItinerarySnapshot } from '../../ui/itinerary-snapshot/itinerary-snapshot';
import { itineraryFilename, itinerarySections } from '../../util/itinerary-image';
import { renderItineraryPng } from '../../data/itinerary-png';

@Component({
  selector: 'app-itinerary-export',
  templateUrl: './itinerary-export.html',
  imports: [FormsModule, UiButton, UiInput, UiField, ErrorToast, ItinerarySnapshot, UiActionBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItineraryExport {
  readonly id = input.required<string>();
  readonly store = inject(TripEditorStore);
  readonly date = signal('');
  readonly includeCosts = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly allSections = computed(() =>
    this.store.current() ? itinerarySections(this.store.current()!) : [],
  );
  readonly sections = computed(() =>
    this.date() ? this.allSections().filter((s) => s.key === this.date()) : this.allSections(),
  );

  constructor() {
    const bar = inject(PageBar);
    effect(() => {
      bar.set({ title: '일정 이미지 저장', back: ['/trips', this.id()], action: null });
      void this.store.open(this.id());
    });
  }

  async download(): Promise<void> {
    const trip = this.store.current();
    if (!trip || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const blob = await renderItineraryPng(trip.title, this.sections(), this.includeCosts());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = itineraryFilename(trip.title, this.date());
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : '이미지를 저장하지 못했습니다.');
    } finally {
      this.busy.set(false);
    }
  }
}
