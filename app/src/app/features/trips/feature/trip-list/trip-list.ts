import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiButton } from '../../../../shared/ui/button/button';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripListStore } from '../../data/trip-list-store';
import { formatPeriod, todayIso, tripTimelineStatus } from '../../../../shared/util/dates';
import type { Trip } from '../../model/trip';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { PageBar } from '../../../../core/page-bar';
import { AuthStore } from '../../../auth/data/auth-store';
import { UiRowMenu, type RowMenuItem } from '../../../../shared/ui/row-menu/row-menu';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { VisitMapBanner } from '../../../stats/ui/visit-map-banner/visit-map-banner';

@Component({
  selector: 'app-trip-list',
  providers: [TripListStore],
  imports: [UiButton, UiNotice, UiBadge, RouterLink, IconComponent, UiRowMenu, VisitMapBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-list.html',
})
export class TripListPage implements OnInit {
  readonly store = inject(TripListStore);
  private readonly pageBar = inject(PageBar);

  constructor() {
    // 상단 바: 왼쪽 T 심볼(홈), 가운데 '내 여행', 오른쪽 닉네임 아바타.
    // 닉네임은 세션 복원 뒤에 채워지므로 effect로 따라간다.
    const auth = inject(AuthStore);
    effect(() => {
      const nickname = auth.nickname();
      this.pageBar.set({
        title: '내 여행',
        back: null,
        action: {
          label: '내 정보',
          link: ['/account'],
          avatar: nickname ? nickname.slice(0, 1) : '나',
          testId: 'go-account',
        },
      });
    });
  }

  private readonly router = inject(Router);
  readonly tripMenu: readonly RowMenuItem[] = [
    { id: 'edit', label: '여행 정보 수정', icon: 'edit' },
    { id: 'delete', label: '삭제', icon: 'trash', danger: true },
  ];
  readonly deleteTripId = signal<string | null>(null);

  /**
   * 첫 화면인지 여부. 여행이 없을 때는 두 갈래를 큰 카드로 세워 무엇이
   * 다른지 읽게 하고, 하나라도 쌓이면 작은 버튼으로 줄여 목록에 자리를 준다.
   */
  readonly isFirstTime = computed(
    () => this.store.listState() === 'ready' && this.store.trips().length === 0,
  );

  onTripMenu(action: string, trip: Trip): void {
    if (action === 'edit') void this.router.navigate(['/trips', trip.id, 'edit']);
    else if (action === 'delete') this.deleteTripId.set(trip.id);
  }

  async confirmDeleteTrip(id: string): Promise<void> {
    if (await this.store.removeTrip(id)) this.deleteTripId.set(null);
  }

  ngOnInit(): void {
    void this.store.loadList();
  }

  period(trip: Trip): string {
    return formatPeriod(trip.startDate, trip.endDate);
  }

  /** 지역을 칩 대신 본문 텍스트 경로로 표시한다(예: 강릉 → 속초). */
  regionPath(trip: Trip): string {
    return trip.regions.map((r) => r.name).join(' → ');
  }

  /** 여행 카드에 표시할 진행 상태 라벨. 종료일 경과는 '완료'가 아니라 '일정 날짜 지남'이다. */
  timelineLabel(trip: Trip): string {
    const status = tripTimelineStatus(trip.startDate, trip.endDate, todayIso());
    switch (status.kind) {
      case 'undecided':
        return '날짜 미정';
      case 'upcoming':
        return `D-${status.daysUntil}`;
      case 'today':
        return 'D-day';
      case 'ongoing':
        return `여행 중 ${status.dayNumber}일차`;
      case 'past':
        return '지난 일정';
    }
  }
}
