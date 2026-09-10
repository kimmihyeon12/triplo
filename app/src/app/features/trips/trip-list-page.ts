import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { formatPeriod, todayIso, tripTimelineStatus } from '../../domain/dates';
import type { Trip } from '../../domain/model';
import { WEATHER_ICON, WEATHER_LABEL } from '../../domain/weather';
import { IconComponent } from '../../shared/icon';
import { PageBar } from '../../shared/page-bar';

@Component({
  selector: 'app-trip-list-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <!-- 여행 만들기 두 갈래: AI가 초안을 짜거나, 직접 채우거나 -->
      <nav class="make" aria-label="여행 만들기">
        <a class="btn btn--ai" routerLink="/trips/ai" data-testid="new-trip-ai">
          <app-icon name="sparkle" [size]="16" /> AI로 만들기
        </a>
        <a class="btn" routerLink="/trips/new" data-testid="new-trip">
          <app-icon name="plus" [size]="16" /> 직접 만들기
        </a>
      </nav>

      @if (store.skippedCount() > 0) {
        <div class="notice notice--warn" role="status">
          <app-icon name="alert" />
          <div class="notice__body">읽을 수 없는 항목 {{ store.skippedCount() }}개를 건너뛰었습니다.</div>
        </div>
      }

      @switch (store.listState()) {
        @case ('loading') {
          <p class="muted" role="status">불러오는 중…</p>
        }
        @case ('error') {
          <div class="notice notice--danger" role="alert">
            <app-icon name="alert" />
            <div class="notice__body">
              <strong>기기 저장소를 읽지 못했습니다.</strong>
              <div class="small">{{ store.listError() }}</div>
              <div class="notice__actions">
                <button type="button" class="btn btn--sm btn--danger" (click)="store.loadList()">다시 시도</button>
              </div>
            </div>
          </div>
        }
        @case ('ready') {
          @if (store.trips().length === 0) {
            <section class="panel empty" data-testid="empty-trips">
              <app-icon name="luggage" [size]="36" />
              <h2>아직 만든 여행이 없습니다</h2>
              <p class="muted">날짜를 정하지 않아도 시작할 수 있습니다. 장소와 숙소는 나중에 채워도 됩니다.</p>
              <a routerLink="/trips/new" class="btn btn--primary">첫 여행 만들기</a>
            </section>
          } @else {
            <ul class="trips" data-testid="trip-list">
              @for (trip of store.trips(); track trip.id) {
                <li class="trips__item">
                  <!--
                    타임라인 구분 행: 얇은 선 사이에 남은 날짜 라벨.
                    날짜 미정·지난 일정은 D-day가 없으므로 그 상태 이름을 대신 쓴다.
                  -->
                  <p class="rule">
                    <span class="rule__line" aria-hidden="true"></span>
                    <span class="rule__label" [attr.data-testid]="'trip-timeline-' + trip.id">{{ timelineLabel(trip) }}</span>
                    <span class="rule__line" aria-hidden="true"></span>
                  </p>

                  <!--
                    3단 위계: 제목(진함) → 날짜(중간) → 메타 한 줄(옅음).
                    목록의 목적은 '어느 여행인지 빠르게 찾기'이므로 칩을 벗기고 덜어낸다.
                    평상시 칩은 0개이고, 확인이 필요한 상태일 때만 하나 나타난다.
                  -->
                  <a class="panel card" [routerLink]="['/trips', trip.id]" [attr.data-testid]="'trip-card-' + trip.id">
                    <h2 class="card__title">{{ trip.title }}</h2>

                    <!-- 제목과 가깝게 붙여 한 덩어리로 읽힌다 -->
                    <p class="card__when">
                      <span>{{ period(trip) }}</span>
                      <!--
                        날씨 자리: 제공자가 아직 없어 항상 '정보 없음'이다.
                        임의의 날씨를 지어내지 않는다. 날짜 미정 여행은 날씨가 무의미하므로 숨긴다.
                      -->
                      @if (trip.startDate && trip.endDate) {
                        <span class="card__weather" [attr.title]="weatherLabel" [attr.aria-label]="weatherLabel">
                          <app-icon [name]="weatherIcon" [size]="14" />
                        </span>
                      }
                    </p>

                    <!-- 메타는 칩을 벗기고 가운뎃점으로 이어 붙인 옅은 한 줄 -->
                    <p class="card__meta">
                      @if (trip.regions.length > 0) {
                        <span class="tag tag--region">{{ regionPath(trip) }}</span>
                      }
                      <span class="tag tag--place">장소 {{ trip.stops.length }}</span>
                      <span class="tag tag--stay">숙소 {{ trip.stays.length }}</span>
                      <span class="card__quiet" [attr.data-testid]="'trip-expense-' + trip.id">지출 미설정</span>
                      <span class="card__dot" aria-hidden="true">·</span>
                      <span class="card__quiet" [attr.data-testid]="'trip-companions-' + trip.id">동행 준비 중</span>
                    </p>
                  </a>
                </li>
              }
            </ul>
          }
        }
      }

      <p class="alpha small muted">내부 알파 · 이 기기에만 저장됩니다</p>
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--sp-2);
        padding: var(--sp-5);
      }
      .empty app-icon {
        color: var(--accent-deep);
        background: var(--accent-tint);
        border-radius: 50%;
        padding: 10px;
        margin-bottom: 2px;
      }
      .empty .btn {
        margin-top: var(--sp-2);
      }

      /*
        타임라인 구분 행: 카드 사이를 얇은 선으로 나누고 가운데에 남은 날짜 라벨을 둔다.
        이 축은 여행마다 색이 바뀌면 흔들려 보이므로 한 가지 회색 톤으로 통일한다.
        의미별 다색은 카드 '안'의 상태·분류 라벨에서만 쓴다.
      */
      .trips {
        display: flex;
        flex-direction: column;
      }
      .rule {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 10px 2px 8px;
      }
      .trips__item:first-child .rule {
        padding-top: 2px;
      }
      .rule__line {
        flex: 1;
        height: 0;
        border-top: 1px solid var(--border);
      }
      .rule__label {
        flex: none;
        font-size: var(--fs-12);
        font-weight: 700;
        line-height: 1.5;
        letter-spacing: 0;
        padding: 2px 9px;
        border-radius: var(--radius-pill);
        color: var(--ink-3);
        background: var(--ground-2);
      }

      /*
        여행 카드: 3줄 고정.
        1줄 제목 + 오른쪽 끝 화살표, 2줄 기간·지역, 3줄 구성 요약.
        화살표는 별도 격자 열이라 제목 길이에 흔들리지 않는다.
      */
      .card {
        display: block;
        padding: var(--sp-4);
        text-decoration: none;
        color: inherit;
        border: 1px solid transparent;
        transition:
          border-color var(--dur) var(--ease-out),
          transform var(--dur) var(--ease-out);
      }
      .card:hover {
        border-color: var(--border-strong);
      }
      .card:active {
        transform: scale(0.994);
      }

      /* 1단: 가장 진하고 크다 */
      .card__title {
        font-size: var(--fs-17);
        font-weight: 700;
        line-height: 1.4;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* 2단: 제목 바로 아래에 붙여 한 덩어리로 읽는다 */
      .card__when {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
        margin-top: var(--sp-1);
        font-size: var(--fs-14);
        color: var(--ink-2);
      }
      /* 날씨 미연결 상태: 흐린 회색 아이콘만. 값을 지어내지 않는다. */
      .card__weather {
        display: inline-flex;
        color: var(--ink-3);
        opacity: 0.6;
      }
      /* 3단: 덩어리를 나누기 위해 위 여백을 넉넉히 준다 */
      .card__meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        font-size: var(--fs-12);
        color: var(--ink-3);
      }
      .card__dot {
        color: var(--border-strong);
      }
      .card__quiet {
        color: var(--ink-3);
      }
      /*
         태그: 의미별로 색을 나눈다. 테두리 없이 옅은 배경만 써서
         카드가 라벨 무더기로 보이지 않게 한다.
      */
      .tag {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: var(--radius-cell);
        font-size: var(--fs-12);
        font-weight: 500;
        line-height: 1.5;
        white-space: nowrap;
      }
      .tag--region {
        background: var(--accent-tint);
        color: var(--accent-deep);
      }
      .tag--place {
        background: var(--ok-tint);
        color: var(--ok-ink);
      }
      .tag--stay {
        background: var(--stay-tint);
        color: var(--stay-ink);
      }
      .alpha {
        text-align: center;
        margin-top: var(--sp-2);
      }

      /* 여행 만들기 두 갈래: 반반 폭. 360px에서도 라벨이 잘리지 않는다. */
      .make {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-2);
      }
      /*
         AI 만들기만 그라데이션을 쓴다(2026-09-10 사용자 승인).
         나머지 버튼·탭·링크는 계속 딥 블루 단색이다.
      */
      .btn--ai {
        background: linear-gradient(135deg, #3b6fef 0%, #6d4fd6 100%);
        border-color: transparent;
        color: #fff;
      }
      .btn--ai:hover {
        background: linear-gradient(135deg, #2f5fdb 0%, #5c40c4 100%);
      }
      .make .btn {
        padding: 0 var(--sp-2);
        white-space: nowrap;
      }
    `,
  ],
})
export class TripListPage implements OnInit {
  readonly store = inject(TripStore);
  private readonly pageBar = inject(PageBar);

  /** 날씨 제공자 미연결: 모든 여행이 '정보 없음'이다. 추정값을 만들지 않는다. */
  readonly weatherIcon = WEATHER_ICON.unknown;
  readonly weatherLabel = WEATHER_LABEL.unknown;

  constructor() {
    // 상단 바: 왼쪽 T 심볼(홈), 가운데 '내 여행'. 새 여행은 우하단 FAB에 있다.
    this.pageBar.set({ title: '내 여행', back: null, action: null });
  }

  ngOnInit(): void {
    this.store.resetSaveState();
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
