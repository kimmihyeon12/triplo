import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripListStore } from '../../data/trip-list-store';
import { formatPeriod, todayIso, tripTimelineStatus } from '../../../../shared/util/dates';
import type { Trip } from '../../model/trip';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { PageBar } from '../../../../core/page-bar';
import { AuthStore } from '../../../auth/data/auth-store';

@Component({
  selector: 'app-trip-list',
  providers: [TripListStore],
  imports: [UiButton, UiNotice, RouterLink, IconComponent],
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
