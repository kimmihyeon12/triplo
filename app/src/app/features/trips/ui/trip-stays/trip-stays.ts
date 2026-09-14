import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { formatKoreanDate } from '../../../../shared/util/dates';
import { TripMapComponent } from '../../../places/ui/trip-map/trip-map';
import { RESERVATION_LABEL, type Trip, type AccommodationStay } from '../../model/trip';
import { buildStaysMap } from '../../util/map-markers';
import { nightCoverage, stayIssues, stayNightCount } from '../../util/stays';

@Component({
  host: { class: 'block' },
  selector: 'app-trip-stays',
  imports: [UiButton, UiBadge, UiNotice, RouterLink, IconComponent, TripMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-stays.html',
})
export class TripStays {
  readonly trip = input.required<Trip>();
  readonly selectedMarkerId = input<string | null>(null);
  readonly markerSelect = output<string>();
  readonly reservationLabel = RESERVATION_LABEL;
  readonly staysMap = computed(() => buildStaysMap(this.trip()));
  readonly overview = computed(() => ({
    undecidedDates: !this.trip().startDate || !this.trip().endDate,
  }));
  readonly nights = computed(() => nightCoverage(this.trip()));
  readonly sortedStays = computed(() =>
    [...this.trip().stays].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
  );
  private readonly issues = computed(() => stayIssues(this.trip()));

  formatDate(date: string, short = false): string {
    return formatKoreanDate(date, { short });
  }

  stayNames(stays: AccommodationStay[]): string {
    return stays.map((s) => s.name).join(' / ');
  }

  nightCount(stay: AccommodationStay): number {
    return stayNightCount(stay);
  }

  issuesFor(id: string): string[] {
    return this.issues().get(id) ?? [];
  }

  regionName(id: string | null): string | null {
    return this.trip().regions.find((r) => r.id === id)?.name ?? null;
  }
}
