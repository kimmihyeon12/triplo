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
import { CompanionFace } from '../../../travel-chat/companion';
import { canDeleteTrip, memberSummary } from '../../util/sharing';
import { UiMemberStack } from '../../../../shared/ui/member-stack/member-stack';

@Component({
  selector: 'app-trip-list',
  providers: [TripListStore],
  imports: [
    UiMemberStack,
    UiButton,
    UiNotice,
    UiBadge,
    RouterLink,
    IconComponent,
    UiRowMenu,
    VisitMapBanner,
    CompanionFace,
  ],
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
  private readonly auth = inject(AuthStore);
  readonly tripMenu: readonly RowMenuItem[] = [
    { id: 'edit', label: '여행 정보 수정', icon: 'edit' },
    { id: 'delete', label: '삭제', icon: 'trash', danger: true },
  ];
  /** 함께 쓰는 여행의 멤버는 지우지 못한다. 대신 함께하는 사람 화면에서 나간다. */
  readonly memberMenu: readonly RowMenuItem[] = [
    { id: 'edit', label: '여행 정보 수정', icon: 'edit' },
    { id: 'members', label: '함께하는 사람·나가기', icon: 'share' },
  ];
  /** 함께 쓰는 여행이면 나와 나머지 수. 로그인한 사람을 '나'로 본다. */
  members(trip: Trip) {
    return memberSummary(trip, this.auth.user()?.id ?? null);
  }
  readonly canDeleteTrip = canDeleteTrip;
  readonly deleteTripId = signal<string | null>(null);

  /**
   * 첫 화면인지 여부. 여행이 없을 때는 두 갈래를 큰 카드로 세워 무엇이
   * 다른지 읽게 하고, 하나라도 쌓이면 작은 버튼으로 줄여 목록에 자리를 준다.
   */

  onTripMenu(action: string, trip: Trip): void {
    if (action === 'edit') void this.router.navigate(['/trips', trip.id, 'edit']);
    else if (action === 'members') void this.router.navigate(['/trips', trip.id, 'invite']);
    else if (action === 'delete' && canDeleteTrip(trip)) this.deleteTripId.set(trip.id);
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
