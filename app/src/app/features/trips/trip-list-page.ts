import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { formatPeriod, todayIso, tripTimelineStatus } from '../../domain/dates';
import type { Trip } from '../../domain/model';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-trip-list-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <section class="hero">
        <div>
          <h1>트립플로</h1>
          <p class="hero__sub">여행을 만들고 장소와 숙소를 정리하세요</p>
        </div>
        <a routerLink="/trips/new" class="btn btn--on-hero" data-testid="new-trip">
          <app-icon name="plus" [size]="16" /> 새 여행
        </a>
      </section>

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
            <ul class="stack" data-testid="trip-list">
              @for (trip of store.trips(); track trip.id) {
                <li>
                  <a class="panel card" [routerLink]="['/trips', trip.id]" [attr.data-testid]="'trip-card-' + trip.id">
                    <div class="card__main">
                      <div class="card__title-row">
                        <h2>{{ trip.title }}</h2>
                        <span [class]="timelineCellClass(trip)" [attr.data-testid]="'trip-timeline-' + trip.id">{{ timelineLabel(trip) }}</span>
                      </div>
                      <p class="card__period">{{ period(trip) }}</p>
                      @if (trip.regions.length > 0) {
                        <p class="row card__regions">
                          @for (r of trip.regions; track r.id; let last = $last) {
                            <span class="cell cell--accent">{{ r.name }}</span>
                            @if (!last) {
                              <app-icon name="arrow-right" [size]="14" class="muted" />
                            }
                          }
                        </p>
                      }
                      <div class="row card__extra">
                        <span class="cell cell--ghost" [attr.data-testid]="'trip-expense-' + trip.id">지출 미설정</span>
                        <span class="cell cell--ghost" [attr.data-testid]="'trip-companions-' + trip.id">
                          <app-icon name="luggage" [size]="12" /> 동행 준비 중
                        </span>
                      </div>
                    </div>
                    <div class="card__meta small muted">
                      <span>장소 {{ trip.stops.length }}개</span>
                      <span>숙소 {{ trip.stays.length }}개</span>
                    </div>
                  </a>
                </li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--sp-3);
        padding: var(--sp-6);
      }
      .empty app-icon {
        color: var(--accent-deep);
        background: var(--accent-tint);
        border-radius: 50%;
        padding: 12px;
      }
      .card {
        display: flex;
        justify-content: space-between;
        gap: var(--sp-3);
        text-decoration: none;
        color: inherit;
        border: 1px solid transparent;
        transition: border-color var(--dur) var(--ease-out);
      }
      .card:hover {
        border-color: var(--border-strong);
      }
      .card__main {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .card h2 {
        font-size: var(--fs-18);
      }
      .card__period {
        color: var(--ink-2);
        font-size: var(--fs-14);
      }
      .card__regions {
        gap: 6px;
      }
      .card__title-row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
      .card__extra {
        gap: 6px;
        margin-top: 2px;
      }
      .card__meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        flex: none;
      }
    `,
  ],
})
export class TripListPage implements OnInit {
  readonly store = inject(TripStore);

  ngOnInit(): void {
    this.store.resetSaveState();
    void this.store.loadList();
  }

  period(trip: Trip): string {
    return formatPeriod(trip.startDate, trip.endDate);
  }

  /** 여행 카드에 표시할 진행 상태 라벨. 종료일 경과는 '완료'가 아니라 '일정 날짜 지남'이다. */
  timelineLabel(trip: Trip): string {
    const status = tripTimelineStatus(trip.startDate, trip.endDate, todayIso());
    switch (status.kind) {
      case 'undecided':
        return '날짜 미정';
      case 'upcoming':
        return `예정 D-${status.daysUntil}`;
      case 'today':
        return '진행중 D-day';
      case 'ongoing':
        return `여행 중 · ${status.dayNumber}일차`;
      case 'past':
        return '일정 날짜 지남';
    }
  }

  /** 상태별 칩 클래스. 진행 중만 강조하고 나머지는 중립 표시다. */
  timelineCellClass(trip: Trip): string {
    const status = tripTimelineStatus(trip.startDate, trip.endDate, todayIso());
    if (status.kind === 'today' || status.kind === 'ongoing') return 'cell cell--solid-accent';
    if (status.kind === 'past') return 'cell cell--warn';
    return 'cell cell--ghost';
  }
}
