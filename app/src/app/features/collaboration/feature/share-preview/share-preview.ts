import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { TRIP_REPOSITORY } from '../../../trips/data/trip-repository';
import type { Trip } from '../../../trips/model/trip';
import { itinerarySections } from '../../../trips/util/itinerary-image';
import { ItinerarySnapshot } from '../../../trips/ui/itinerary-snapshot/itinerary-snapshot';

@Component({
  selector: 'app-share-preview',
  templateUrl: './share-preview.html',
  imports: [RouterLink, UiButton, UiNotice, IconComponent, ItinerarySnapshot],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharePreview {
  readonly id = input.required<string>();
  readonly view = input('guest');
  readonly trip = signal<Trip | null>(null);
  readonly loading = signal(true);
  readonly sections = computed(() => (this.trip() ? itinerarySections(this.trip()!) : []));

  constructor() {
    const repo = inject(TRIP_REPOSITORY);
    const bar = inject(PageBar);
    effect((cleanup) => {
      let active = true;
      cleanup(() => {
        active = false;
      });
      bar.set({ title: '공유 일정 미리보기', back: ['/trips', this.id(), 'invite'], action: null });
      this.loading.set(true);
      this.trip.set(null);
      void repo
        .get(this.id())
        .then((trip) => {
          if (active) this.trip.set(trip);
        })
        .catch(() => {})
        .finally(() => {
          if (active) this.loading.set(false);
        });
    });
  }
}
