import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiRowMenu, type RowMenuItem } from '../../../../shared/ui/row-menu/row-menu';
import { copyText, kakaoSearchUrl, mapQuery, naverSearchUrl } from '../../../places/data/map-links';
import { formatKoreanDate } from '../../../../shared/util/dates';
import { RESERVATION_LABEL, type Trip, type AccommodationStay } from '../../model/trip';
import { nightCoverage, stayIssues, stayNightCount } from '../../util/stays';

@Component({
  host: { class: 'block' },
  selector: 'app-trip-stays',
  imports: [UiButton, UiBadge, UiNotice, IconComponent, UiRowMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-stays.html',
})
export class TripStays {
  readonly trip = input.required<Trip>();
  readonly reservationLabel = RESERVATION_LABEL;
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

  readonly copiedId = signal<string | null>(null);

  naverUrl(stay: AccommodationStay): string {
    return naverSearchUrl(mapQuery(stay.name, stay.address));
  }

  kakaoUrl(stay: AccommodationStay): string {
    return kakaoSearchUrl(mapQuery(stay.name, stay.address));
  }

  async copyAddress(stay: AccommodationStay): Promise<void> {
    if (!stay.address) return;
    if (await copyText(stay.address)) {
      this.copiedId.set(stay.id);
      setTimeout(() => {
        if (this.copiedId() === stay.id) this.copiedId.set(null);
      }, 1500);
    }
  }

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

  /** 예약 완료는 확인됨(녹색), 미정은 확인 필요(노랑), 미예약은 회색으로 둔다. */
  reservationCell(state: AccommodationStay['reservation']): string {
    if (state === 'reserved') return 'cell--ok';
    if (state === 'unknown') return 'cell--warn';
    return 'cell--ghost';
  }
}
