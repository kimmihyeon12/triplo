import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiRowMenu, type RowMenuItem } from '../../../../shared/ui/row-menu/row-menu';
import { formatKoreanDate } from '../../../../shared/util/dates';
import { TripMapComponent } from '../../../places/ui/trip-map/trip-map';
import { RESERVATION_LABEL, type Trip, type AccommodationStay } from '../../model/trip';
import { buildStaysMap } from '../../util/map-markers';
import { nightCoverage, stayIssues, stayNightCount } from '../../util/stays';

@Component({
  host: { class: 'block' },
  selector: 'app-trip-stays',
  imports: [UiButton, UiBadge, UiNotice, RouterLink, IconComponent, TripMapComponent, UiRowMenu],
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
  private readonly router = inject(Router);

  /** 삭제는 상위가 저장소에 반영한다. 이 컴포넌트는 표시와 확인만 맡는다. */
  readonly stayDelete = output<string>();
  readonly deleteStayId = signal<string | null>(null);

  stayMenu(stay: AccommodationStay): RowMenuItem[] {
    return [
      { id: 'edit', label: '편집', icon: 'edit', testId: 'edit-stay-' + stay.id },
      { id: 'delete', label: '삭제', icon: 'trash', danger: true, testId: 'delete-stay-' + stay.id },
    ];
  }

  onStayMenu(action: string, stay: AccommodationStay): void {
    if (action === 'edit')
      void this.router.navigate(['/trips', this.trip().id, 'stays', stay.id]);
    else if (action === 'delete') this.deleteStayId.set(stay.id);
  }

  confirmDeleteStay(stayId: string): void {
    this.stayDelete.emit(stayId);
    this.deleteStayId.set(null);
  }

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
