import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { enumerateDays, formatKoreanDate, formatPeriod } from '../../domain/dates';
import { daySegments, dayTotals, fixedTimeConflicts, formatMinutes, moveStop, toggleExcluded } from '../../domain/itinerary';
import { RESERVATION_LABEL, STOP_KIND_LABEL, type AccommodationStay, type IsoDate, type Trip, type TripStop } from '../../domain/model';
import { buildOverview } from '../../domain/overview';
import { dayStayInfo, nightCoverage, stayIssues, stayNightCount } from '../../domain/stays';
import { IconComponent } from '../../shared/icon';
import { copyText, kakaoSearchUrl, mapQuery, naverSearchUrl } from '../../shared/map-links';
import { SaveStatusComponent } from '../../shared/save-status';
import { TripMapComponent } from '../../shared/trip-map';
import { buildDayMap, buildStaysMap, type DayMapModel } from '../../domain/map-markers';

type Tab = 'overview' | 'days' | 'stays';

@Component({
  selector: 'app-trip-detail-page',
  imports: [RouterLink, IconComponent, SaveStatusComponent, TripMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.currentState() === 'loading' && !trip()) {
      <div class="page"><p class="muted" role="status">불러오는 중…</p></div>
    } @else if (!trip()) {
      <div class="page">
        <div class="notice notice--danger" role="alert">
          <app-icon name="alert" />
          <div class="notice__body">
            <strong>여행을 찾을 수 없습니다.</strong>
            <div class="notice__actions"><a routerLink="/trips" class="btn btn--sm">목록으로</a></div>
          </div>
        </div>
      </div>
    } @else {
      <div class="page stack">
        <!-- 머리글 표지판 -->
        <header class="hero head" data-testid="trip-header">
          <div class="head__top">
            <a class="btn btn--icon btn--on-hero" routerLink="/trips" aria-label="트립플로 목록으로"><app-icon name="back" /></a>
            <app-save-status />
          </div>
          <h1 data-testid="trip-title">{{ trip()!.title }}</h1>
          <p class="head__period" data-testid="trip-period">{{ period() }}</p>
          <div class="head__bottom">
            @if (trip()!.regions.length > 0) {
              <p class="row head__regions" data-testid="trip-regions">
                @for (r of trip()!.regions; track r.id; let last = $last) {
                  <span class="head__region">{{ r.name }}</span>
                  @if (!last) {
                    <span class="head__link" aria-hidden="true"></span>
                  }
                }
              </p>
            } @else {
              <p class="hero__sub">지역 미지정</p>
            }
            <a class="btn btn--on-hero btn--sm" [routerLink]="['/trips', trip()!.id, 'edit']" data-testid="trip-edit"><app-icon name="edit" [size]="14" /> 편집</a>
          </div>
        </header>

        <!-- 탭 -->
        <nav class="tabs" role="tablist" aria-label="여행 보기">
          @for (t of tabs; track t.id) {
            <a
              class="tab"
              role="tab"
              [class.tab--on]="activeTab() === t.id"
              [attr.aria-selected]="activeTab() === t.id"
              [routerLink]="[]"
              [queryParams]="{ tab: t.id, day: selectedDay() }"
              queryParamsHandling="merge"
              [attr.data-testid]="'tab-' + t.id"
            >
              {{ t.ko }}
            </a>
          }
        </nav>

        <!-- 전체 보기 -->
        @if (activeTab() === 'overview') {
          <section class="stack" role="tabpanel" data-testid="panel-overview">
            @if (overview().undecidedDates) {
              <div class="notice notice--warn">
                <app-icon name="calendar" />
                <div class="notice__body">
                  <strong>날짜 미정 초안</strong>입니다. 날짜를 정하면 날짜별 일정과 숙박 날짜를 확인할 수 있습니다.
                  <div class="notice__actions"><a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'edit']">날짜 정하기</a></div>
                </div>
              </div>
            } @else if (isEmptyTrip()) {
              <section class="panel empty" data-testid="empty-trip">
                <h2>장소와 숙소를 추가해 보세요</h2>
                <p class="muted">날짜에 배치하지 않은 장소는 미배치 목록에 남고, 숙소 미정인 밤이 있어도 저장됩니다.</p>
              </section>
            }

            @if (overview().days.length > 0) {
              <ol class="ov" data-testid="overview-days">
                @for (d of overview().days; track d.date) {
                  <li>
                    <a class="ov__row" [routerLink]="[]" [queryParams]="{ tab: 'days', day: d.date }" queryParamsHandling="merge" [attr.data-testid]="'overview-day-' + d.dayNumber">
                      <span class="ov__no" [attr.aria-label]="d.dayNumber + '일차'"><span class="ov__day" aria-hidden="true">{{ d.dayNumber }}</span></span>
                      <span class="ov__main">
                        <span class="ov__date">
                          {{ formatDate(d.date) }}
                          @for (r of d.regionNames; track r) {
                            <span class="cell cell--accent">{{ r }}</span>
                          }
                          @if (d.regionChangeCount > 0) {
                            <span class="cell cell--ghost">지역 이동 {{ d.regionChangeCount }}회</span>
                          }
                        </span>
                        <span class="ov__stops">
                          @if (d.stopNames.length === 0) {
                            <span class="muted">일정 없음</span>
                          } @else {
                            {{ summarize(d.stopNames) }}
                          }
                        </span>
                        <span class="ov__meta small muted">
                          @if (d.totals.activeCount > 0) {
                            <span>체류 {{ minutes(d.totals.stayMinutes) }}</span>
                            @if (d.totals.unknownStayCount > 0) {
                              <span>· 체류 미정 {{ d.totals.unknownStayCount }}</span>
                            }
                            @if (d.totals.legCount > 0) {
                              <span>· 이동 {{ d.totals.unknownLegCount }}구간 미확인</span>
                            }
                          }
                          @if (d.fixedTimeConflictCount > 0) {
                            <span class="cell cell--danger">고정 시각 충돌 {{ d.fixedTimeConflictCount }}</span>
                          }
                        </span>
                      </span>
                      <span class="ov__night cell" [class]="nightCellClass(d.nightState)" [attr.data-testid]="'overview-night-' + d.dayNumber">
                        <app-icon [name]="d.nightState === 'none' ? 'arrow-right' : 'bed'" [size]="14" />
                        {{ d.nightLabel }}
                      </span>
                    </a>
                  </li>
                }
              </ol>
            }

            @if (overview().unassigned.length > 0) {
              <section class="panel" data-testid="unassigned">
                <h3 class="section-title">미배치 장소 <span class="cell cell--ghost">{{ overview().unassigned.length }}</span></h3>
                <ul class="plain-list">
                  @for (s of overview().unassigned; track s.id) {
                    <li class="row plain-item">
                      <span class="cell cell--place"><app-icon [name]="s.kind" [size]="14" /> {{ kindLabel[s.kind] }}</span>
                      <span class="grow">{{ s.name }}</span>
                      <a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'stops', s.id]" [attr.data-testid]="'place-' + s.id">날짜 배치</a>
                    </li>
                  }
                </ul>
              </section>
            }

            @if (overview().issues.length > 0) {
              <section class="panel" data-testid="issues">
                <h3 class="section-title">확인 필요</h3>
                <ul class="plain-list">
                  @for (i of overview().issues; track i.kind) {
                    <li class="row plain-item">
                      <span class="cell" [class.cell--danger]="i.kind === 'stay-conflict' || i.kind === 'fixed-time'" [class.cell--warn]="i.kind !== 'stay-conflict' && i.kind !== 'fixed-time'">{{ i.count }}</span>
                      <span class="grow">{{ i.label }}</span>
                      <a class="btn btn--ghost btn--sm" [routerLink]="[]" [queryParams]="{ tab: i.tab }" queryParamsHandling="merge">보기</a>
                    </li>
                  }
                </ul>
                <p class="small muted" style="margin-top:8px">위치 미확인은 장소 검색·경로 연동 전까지 모든 항목에 표시됩니다. 추정 좌표나 이동시간은 만들지 않습니다.</p>
              </section>
            }
          </section>
        }

        <!-- 날짜별 보기 -->
        @if (activeTab() === 'days') {
          <section role="tabpanel" data-testid="panel-days">
            @if (overview().undecidedDates) {
              <div class="notice notice--warn">
                <app-icon name="calendar" />
                <div class="notice__body">
                  날짜를 정하면 날짜별 일정을 만들 수 있습니다.
                  <div class="notice__actions"><a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'edit']">날짜 정하기</a></div>
                </div>
              </div>
            } @else {
              <div class="days-layout">
                <div class="daytabs" role="tablist" aria-label="날짜 선택" (keydown)="onDayKey($event)">
                  @for (d of days(); track d; let i = $index) {
                    <a
                      class="daytab"
                      role="tab"
                      [class.daytab--on]="selectedDay() === d"
                      [attr.aria-selected]="selectedDay() === d"
                      [attr.tabindex]="selectedDay() === d ? 0 : -1"
                      [routerLink]="[]"
                      [queryParams]="{ tab: 'days', day: d }"
                      queryParamsHandling="merge"
                      [attr.data-testid]="'daytab-' + (i + 1)"
                    >
                      <span class="daytab__no">{{ i + 1 }}일차</span>
                      <span class="daytab__date">{{ formatDate(d, true) }}</span>
                    </a>
                  }
                </div>

                <div class="stack day-body" [attr.data-testid]="'day-' + selectedDay()">
                  <app-trip-map class="day-map" [model]="dayMap()" [selectedId]="selectedMarkerId()" (markerSelect)="onMarkerSelect($event)" />
                  <!-- 숙소 정보 -->
                  <div class="stayinfo" data-testid="day-stay-info">
                    @if (stayInfo().checkOuts.length > 0) {
                      @for (s of stayInfo().checkOuts; track s.id) {
                        <span class="cell cell--stay"><app-icon name="bed" [size]="14" /> {{ s.name }} 체크아웃{{ s.checkOutTime ? ' ' + s.checkOutTime : ' · 시각 미정' }}</span>
                      }
                    }
                    @if (stayInfo().lastDay) {
                      <span class="cell cell--ghost">마지막 날 · 귀가</span>
                    } @else if (stayInfo().tonight.length === 0) {
                      <span class="cell cell--warn"><app-icon name="alert" [size]="14" /> 이 날 밤 숙소 미정</span>
                      <a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'stays', 'new']">숙소 추가</a>
                    } @else {
                      @for (s of stayInfo().tonight; track s.id) {
                        <span class="cell" [class.cell--stay]="stayInfo().tonight.length === 1" [class.cell--danger]="stayInfo().tonight.length > 1">
                          <app-icon name="bed" [size]="14" />
                          {{ s.name }} {{ stayInfo().consecutive ? '연박' : '체크인' + (s.checkInTime ? ' ' + s.checkInTime : ' · 시각 미정') }}
                        </span>
                      }
                      @if (stayInfo().tonight.length > 1) {
                        <span class="cell cell--danger">숙박 중복</span>
                      }
                    }
                  </div>

                  @if (dayRegions().length > 0) {
                    <p class="row">
                      @for (r of dayRegions(); track r; let last = $last) {
                        <span class="cell cell--accent">{{ r }}</span>
                        @if (!last) {
                          <app-icon name="arrow-right" [size]="14" class="muted" />
                        }
                      }
                    </p>
                  }

                  @if (conflicts().length > 0) {
                    <div class="notice notice--danger" role="alert" data-testid="fixed-conflict">
                      <app-icon name="alert" />
                      <div class="notice__body">고정 시각 순서가 맞지 않는 항목이 {{ conflicts().length }}건 있습니다. 순서를 바꾸거나 시각을 수정하세요.</div>
                    </div>
                  }

                  <!-- 시간순 항목 -->
                  @if (segments().length === 0) {
                    <section class="panel empty" data-testid="empty-day">
                      <h3>이 날 일정이 없습니다</h3>
                      <p class="muted small">장소나 식사·휴식을 추가하면 순서대로 정리됩니다.</p>
                    </section>
                  } @else {
                    <ol class="items" data-testid="day-items">
                      @for (seg of segments(); track segKey(seg, $index); let idx = $index) {
                        @if (seg.type === 'leg') {
                          <li class="leg" [class.leg--change]="seg.regionChange" aria-label="이동 구간">
                            <span class="leg__line"></span>
                            @if (seg.regionChange) {
                              <span class="cell cell--ghost leg__change"><app-icon name="arrow-down" [size]="12" /> {{ seg.fromRegion }} → {{ seg.toRegion }} 이동 · 시간 미확인</span>
                            } @else {
                              <span class="cell cell--ghost">이동 · 시간 미확인</span>
                            }
                          </li>
                        } @else {
                          <li class="item" [class.item--excluded]="seg.stop.excluded" [class.flash]="flashId() === seg.stop.id" [class.item--conflict]="isConflicted(seg.stop.id)" [class.item--selected]="selectedMarkerId() === seg.stop.id" [attr.data-testid]="'stop-' + seg.stop.id" [id]="'stop-card-' + seg.stop.id">
                            <button type="button" class="item__badge" [class.item__badge--place]="seg.stop.kind === 'place'" [class.item__badge--unverified]="!seg.stop.location" [attr.aria-label]="stopNumber(idx) + '번째' + (seg.stop.location ? ', 지도에서 보기' : ', 위치 미확인')" (click)="selectStop(seg.stop.id)" [attr.data-testid]="'badge-' + seg.stop.id">
                              @if (seg.stop.excluded) {
                                <app-icon name="eye-off" [size]="16" />
                              } @else {
                                {{ stopNumber(idx) }}
                              }
                            </button>
                            <div class="item__main">
                              <div class="item__title">
                                <strong>{{ seg.stop.name }}</strong>
                                @if (seg.stop.excluded) {
                                  <span class="cell cell--ghost">제외됨</span>
                                }
                                @if (seg.stop.fixedTime) {
                                  <span class="cell" [class.cell--danger]="isConflicted(seg.stop.id)" [class.cell--ghost]="!isConflicted(seg.stop.id)"><app-icon name="lock" [size]="12" /> {{ seg.stop.fixedTime }} 고정</span>
                                }
                              </div>
                              <div class="item__meta small">
                                <span class="muted">{{ kindLabel[seg.stop.kind] }}</span>
                                @if (regionName(seg.stop.regionId); as rn) {
                                  <span class="muted">· {{ rn }}</span>
                                }
                                @if (seg.stop.stayMinutes !== null) {
                                  <span class="muted">· 체류 {{ minutes(seg.stop.stayMinutes) }}</span>
                                } @else {
                                  <span class="muted">· 체류 미정</span>
                                }
                                @if (seg.stop.location) {
                                  <span class="cell cell--ok item__unverified"><app-icon name="pin" [size]="12" /> 위치 확인됨</span>
                                } @else {
                                  <span class="cell cell--warn item__unverified">위치 미확인</span>
                                }
                              </div>
                              @if (seg.stop.address) {
                                <div class="item__addr small muted">{{ seg.stop.address }}</div>
                              }
                              @if (seg.stop.memo) {
                                <div class="item__memo small">{{ seg.stop.memo }}</div>
                              }
                              <div class="item__links row">
                                <a class="btn btn--ghost btn--sm" [href]="naverUrl(seg.stop)" target="_blank" rel="noopener noreferrer"><app-icon name="map" [size]="14" /> 네이버지도 검색</a>
                                <a class="btn btn--ghost btn--sm" [href]="kakaoUrl(seg.stop)" target="_blank" rel="noopener noreferrer"><app-icon name="map" [size]="14" /> 카카오맵 검색</a>
                                @if (seg.stop.address) {
                                  <button type="button" class="btn btn--ghost btn--sm" (click)="copyAddress(seg.stop)" [attr.data-testid]="'copy-' + seg.stop.id">
                                    <app-icon name="copy" [size]="14" /> {{ copiedId() === seg.stop.id ? '복사됨' : '주소 복사' }}
                                  </button>
                                }
                              </div>
                              @if (copyFallback() && copyFallbackId() === seg.stop.id) {
                                <p class="small copy-fallback">클립보드를 사용할 수 없습니다. 아래 주소를 직접 선택해 복사하세요.<br /><output class="copy-fallback__text">{{ seg.stop.address }}</output></p>
                              }
                            </div>
                            <div class="item__actions">
                              <button type="button" class="btn btn--icon" [disabled]="isFirst(idx)" (click)="move(seg.stop.id, 'up')" [attr.aria-label]="seg.stop.name + ' 위로'" [attr.data-testid]="'up-' + seg.stop.id"><app-icon name="arrow-up" [size]="16" /></button>
                              <button type="button" class="btn btn--icon" [disabled]="isLast(idx)" (click)="move(seg.stop.id, 'down')" [attr.aria-label]="seg.stop.name + ' 아래로'" [attr.data-testid]="'down-' + seg.stop.id"><app-icon name="arrow-down" [size]="16" /></button>
                              <a class="btn btn--icon" [routerLink]="['/trips', trip()!.id, 'stops', seg.stop.id]" [attr.aria-label]="seg.stop.name + ' 편집'" [attr.data-testid]="'edit-' + seg.stop.id"><app-icon name="edit" [size]="16" /></a>
                              <button type="button" class="btn btn--icon" (click)="toggle(seg.stop.id)" [attr.aria-label]="seg.stop.name + (seg.stop.excluded ? ' 복원' : ' 제외')" [attr.aria-pressed]="seg.stop.excluded" [attr.data-testid]="'exclude-' + seg.stop.id"><app-icon [name]="seg.stop.excluded ? 'eye' : 'eye-off'" [size]="16" /></button>
                            </div>
                          </li>
                        }
                      }
                    </ol>
                  }

                  <!-- 합계 -->
                  <div class="panel totals" data-testid="day-totals">
                    <span class="totals__label">하루 합계</span>
                    <span class="row">
                      <span class="cell cell--place">체류 {{ minutes(totals().stayMinutes) }}</span>
                      @if (totals().unknownStayCount > 0) {
                        <span class="cell cell--ghost">체류 미정 {{ totals().unknownStayCount }}개</span>
                      }
                      <span class="cell cell--ghost">이동 {{ totals().legCount }}구간 · 시간 미확인</span>
                    </span>
                    <p class="small muted">도착 시각은 이동시간이 조회되기 전까지 제시하지 않습니다.</p>
                  </div>

                  <div class="row">
                    <a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'stops', 'new']" [queryParams]="{ kind: 'meal', date: selectedDay() }" data-testid="add-meal"><app-icon name="meal" [size]="14" /> 식사 추가</a>
                    <a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'stops', 'new']" [queryParams]="{ kind: 'break', date: selectedDay() }" data-testid="add-break"><app-icon name="break" [size]="14" /> 휴식 추가</a>
                    <a class="btn btn--sm" [routerLink]="['/trips', trip()!.id, 'stops', 'new']" [queryParams]="{ kind: 'buffer', date: selectedDay() }"><app-icon name="buffer" [size]="14" /> 여유시간 추가</a>
                  </div>
                </div>
              </div>
            }
          </section>
        }

        <!-- 숙소 보기 -->
        @if (activeTab() === 'stays') {
          <section class="stack" role="tabpanel" data-testid="panel-stays">
            @if (trip()!.stays.length > 0) {
              <app-trip-map class="stays-map" [model]="staysMap()" [selectedId]="selectedMarkerId()" (markerSelect)="onMarkerSelect($event)" />
            }
            @if (overview().undecidedDates) {
              <div class="notice notice--warn">
                <app-icon name="calendar" />
                <div class="notice__body">여행 날짜 미정: 등록한 숙박 날짜는 여행 날짜를 정한 뒤 확인 대상이 됩니다.</div>
              </div>
            } @else if (nights().length === 0) {
              <div class="notice notice--ok" data-testid="no-nights">
                <app-icon name="check" />
                <div class="notice__body">당일 여행은 숙박이 없습니다. 숙소 등록 없이 일정을 작성할 수 있습니다.</div>
              </div>
            } @else {
              <section class="panel">
                <h3 class="section-title">밤별 숙소</h3>
                <ol class="nights" data-testid="nights">
                  @for (n of nights(); track n.night) {
                    <li class="night" [attr.data-testid]="'night-' + n.nightNumber" [attr.data-state]="n.state">
                      <span class="night__no">{{ n.nightNumber }}박</span>
                      <span class="night__date muted small">{{ formatDate(n.night, true) }} 밤</span>
                      <span class="night__stay">
                        @switch (n.state) {
                          @case ('undecided') {
                            <span class="cell cell--warn">미정</span>
                          }
                          @case ('conflict') {
                            <span class="cell cell--danger">중복: {{ stayNames(n.stays) }}</span>
                          }
                          @default {
                            <span class="cell cell--stay"><app-icon name="bed" [size]="14" /> {{ n.stays[0].name }}{{ n.consecutive ? ' (연박)' : '' }}</span>
                          }
                        }
                      </span>
                    </li>
                  }
                </ol>
              </section>
            }

            @if (trip()!.stays.length === 0) {
              <section class="panel empty" data-testid="empty-stays">
                <h3>등록된 숙소가 없습니다</h3>
                <p class="muted small">숙소 미정인 밤이 있어도 일정은 저장됩니다.</p>
              </section>
            } @else {
              <ul class="stack" data-testid="stay-list">
                @for (s of sortedStays(); track s.id) {
                  <li class="panel stay" [class.item--selected]="selectedMarkerId() === s.id" [attr.data-testid]="'stay-' + s.id" [id]="'stay-card-' + s.id">
                    <div class="stay__badge"><app-icon name="bed" [size]="18" /></div>
                    <div class="stay__main">
                      <div class="row">
                        <strong>{{ s.name }}</strong>
                        @for (issue of issuesFor(s.id); track issue) {
                          <span class="cell" [class.cell--danger]="issue === '다른 숙박과 중복'" [class.cell--warn]="issue !== '다른 숙박과 중복'">{{ issue }}</span>
                        }
                      </div>
                      <div class="small">
                        {{ formatDate(s.checkIn, true) }} 체크인{{ s.checkInTime ? ' ' + s.checkInTime : ' (시각 미정)' }} → {{ formatDate(s.checkOut, true) }} 체크아웃{{ s.checkOutTime ? ' ' + s.checkOutTime : ' (시각 미정)' }}
                        · <strong>{{ nightCount(s) }}박</strong>
                      </div>
                      <div class="row small">
                        <span class="cell cell--ghost">{{ reservationLabel[s.reservation] }}</span>
                        @if (regionName(s.regionId); as rn) {
                          <span class="cell cell--accent">{{ rn }}</span>
                        }
                        @if (s.location) {
                          <span class="cell cell--ok"><app-icon name="pin" [size]="12" /> 위치 확인됨</span>
                        } @else {
                          <span class="cell cell--warn">위치 미확인</span>
                        }
                      </div>
                      @if (s.address) {
                        <div class="small muted">{{ s.address }}</div>
                      }
                      @if (s.memo) {
                        <div class="small">{{ s.memo }}</div>
                      }
                    </div>
                    <div class="stay__actions">
                      <a class="btn btn--icon" [routerLink]="['/trips', trip()!.id, 'stays', s.id]" [attr.aria-label]="s.name + ' 편집'" [attr.data-testid]="'edit-stay-' + s.id"><app-icon name="edit" [size]="16" /></a>
                    </div>
                  </li>
                }
              </ul>
            }
          </section>
        }

        <div class="action-bar">
          <div class="action-bar__inner">
            <a class="btn btn--primary" [routerLink]="['/trips', trip()!.id, 'stops', 'new']" [queryParams]="activeTab() === 'days' && selectedDay() ? { date: selectedDay() } : {}" data-testid="add-stop"><app-icon name="place" [size]="16" /> 장소 추가</a>
            <a class="btn" [routerLink]="['/trips', trip()!.id, 'stays', 'new']" data-testid="add-stay"><app-icon name="bed" [size]="16" /> 숙소 추가</a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .head {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .head__top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .head h1 {
        font-size: var(--fs-28);
        line-height: 1.25;
        overflow-wrap: anywhere;
        margin-top: 2px;
      }
      .head__period {
        font-size: var(--fs-14);
        color: var(--ink-2);
      }
      .head__bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .head__regions {
        gap: 6px;
        font-size: var(--fs-14);
        font-weight: 500;
        color: var(--ink-2);
      }
      .head__region {
        overflow-wrap: anywhere;
      }
      .head__link {
        width: 14px;
        height: 0;
        border-top: 1.5px solid var(--border-strong);
        flex: none;
      }

      .tabs {
        display: flex;
        border-bottom: 1px solid var(--border);
      }
      .tab {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 44px;
        text-decoration: none;
        color: var(--ink-2);
        font-size: var(--fs-15);
        font-weight: 500;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition:
          color var(--dur) var(--ease-out),
          border-color var(--dur) var(--ease-out);
      }
      .tab:hover {
        color: var(--ink);
      }
      .tab--on {
        color: var(--ink);
        font-weight: 700;
        border-bottom-color: var(--accent-deep);
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .plain-list {
        display: flex;
        flex-direction: column;
      }
      .plain-item {
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid var(--border);
      }
      .plain-item:first-child {
        border-top: 0;
      }
      .grow {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .empty {
        padding: var(--sp-5);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .empty h2,
      .empty h3 {
        font-size: var(--fs-16);
      }

      /* 전체 보기 행 */
      .ov {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ov__row {
        display: grid;
        grid-template-columns: 40px 1fr;
        gap: 8px 12px;
        padding: 14px 16px 14px 14px;
        background: var(--panel);
        border: 1px solid transparent;
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow-panel);
        text-decoration: none;
        color: inherit;
        transition: border-color var(--dur) var(--ease-out);
      }
      .ov__row:hover {
        border-color: var(--border-strong);
      }
      .ov__no {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: var(--accent-deep);
        color: #fff;
        border-radius: 50%;
        grid-row: span 2;
        align-self: start;
      }
      .ov__day {
        font-size: var(--fs-16);
        font-weight: 700;
        line-height: 1;
      }
      .ov__main {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .ov__date {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-weight: 700;
      }
      .ov__stops {
        overflow-wrap: anywhere;
        color: var(--ink-2);
      }
      .ov__meta {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        align-items: center;
      }
      .ov__night {
        grid-column: 2;
        justify-self: start;
        white-space: normal;
        text-align: left;
      }
      @media (min-width: 720px) {
        .ov__row {
          grid-template-columns: 40px 1fr auto;
          align-items: center;
        }
        .ov__no {
          grid-row: auto;
        }
        .ov__night {
          grid-column: 3;
          max-width: 260px;
        }
      }

      /* 날짜별 */
      .days-layout {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
      .daytabs {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 2px 32px 6px 2px;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
        mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
      }
      .daytabs::-webkit-scrollbar {
        display: none;
      }
      .daytab {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 72px;
        padding: 7px 12px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-pill);
        background: var(--panel);
        color: var(--ink-2);
        text-decoration: none;
        scroll-snap-align: start;
        transition:
          background-color var(--dur) var(--ease-out),
          border-color var(--dur) var(--ease-out),
          color var(--dur) var(--ease-out);
      }
      .daytab:hover {
        border-color: var(--ink-3);
        color: var(--ink);
      }
      .daytab--on {
        background: var(--ink);
        border-color: var(--ink);
        color: #fff;
      }
      .daytab__no {
        font-size: var(--fs-14);
        font-weight: 700;
        line-height: 1.2;
      }
      .daytab__date {
        font-size: var(--fs-12);
        font-weight: 400;
        opacity: 0.85;
      }
      @media (min-width: 900px) {
        .days-layout {
          display: grid;
          grid-template-columns: 180px 1fr;
          align-items: start;
        }
        .daytabs {
          flex-direction: column;
          overflow: visible;
          position: sticky;
          top: 16px;
          padding-right: 2px;
          mask-image: none;
        }
        .daytab {
          align-items: flex-start;
          border-radius: var(--radius-control);
        }
      }
      .stayinfo {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }

      /* 시간순 목록: 한 카드 안에 구분선 */
      .items {
        display: flex;
        flex-direction: column;
        background: var(--panel);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow-panel);
        overflow: hidden;
      }
      .item {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 8px 12px;
        padding: 14px 16px;
        background: var(--panel);
        border-top: 1px solid var(--border);
        transition: background-color var(--dur) var(--ease-out);
      }
      .item:first-child {
        border-top: 0;
      }
      .item--conflict {
        outline: 1px solid var(--danger-ink);
        outline-offset: -1px;
      }
      .item--selected {
        background: var(--accent-tint);
      }
      .item--excluded .item__main {
        opacity: 0.5;
      }
      .item--excluded .item__badge {
        background: var(--ground-2);
        color: var(--ink-3);
      }
      .item__badge {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--ground-2);
        color: var(--ink);
        font-size: var(--fs-13);
        font-weight: 700;
        border: 0;
        cursor: pointer;
        padding: 0;
        margin-top: 1px;
      }
      .item__badge--place {
        background: var(--accent-deep);
        color: #fff;
      }
      .item__badge--unverified {
        opacity: 0.55;
      }
      .item__main {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .item__title {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: var(--fs-15);
        overflow-wrap: anywhere;
      }
      .item__meta {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        align-items: center;
        color: var(--ink-3);
      }
      .item__unverified {
        margin-left: 2px;
      }
      .item__memo {
        white-space: pre-wrap;
        color: var(--ink-2);
      }
      .item__links {
        gap: 0;
        margin-left: -10px;
      }
      .item__actions {
        grid-column: 1 / -1;
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        padding-top: 4px;
      }
      @media (min-width: 720px) {
        .item {
          grid-template-columns: 28px 1fr auto;
        }
        .item__actions {
          grid-column: auto;
          padding-top: 0;
          align-self: start;
        }
      }
      .items .leg {
        border-top: 1px solid var(--border);
      }
      .leg__change {
        color: var(--ink-2);
        background: var(--panel-2);
        border-color: var(--border);
      }
      .copy-fallback {
        color: var(--warn-ink);
      }
      .copy-fallback__text {
        display: inline-block;
        margin-top: 4px;
        padding: 4px 8px;
        background: var(--ground-2);
        border-radius: var(--radius-cell);
        user-select: all;
        color: var(--ink);
      }

      .totals {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .totals__label {
        font-size: var(--fs-15);
        font-weight: 700;
      }

      /* 숙소 */
      .nights {
        display: flex;
        flex-direction: column;
      }
      .night {
        display: grid;
        grid-template-columns: 40px 76px 1fr;
        align-items: center;
        gap: 8px;
        padding: 10px 0;
        border-top: 1px solid var(--border);
      }
      .night:first-child {
        border-top: 0;
      }
      .night__no {
        font-size: var(--fs-14);
        font-weight: 700;
        color: var(--stay-ink);
      }
      .night__stay .cell {
        white-space: normal;
      }
      .stay {
        display: grid;
        grid-template-columns: 36px 1fr auto;
        gap: 12px;
        border: 1px solid transparent;
      }
      .stay__badge {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--stay-tint);
        color: var(--stay-ink);
      }
      .stay__main {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .stay.item--selected {
        border-color: var(--accent-deep);
        background: var(--panel);
      }
      .day-map,
      .stays-map {
        display: block;
      }
      @media (min-width: 900px) {
        .day-map,
        .stays-map {
          --map-height: 380px;
        }
      }
    `,
  ],
})
export class TripDetailPage {
  readonly id = input.required<string>();
  readonly tab = input<string | undefined>();
  readonly day = input<string | undefined>();

  readonly store = inject(TripStore);
  private readonly router = inject(Router);

  readonly tabs: { id: Tab; ko: string }[] = [
    { id: 'overview', ko: '전체' },
    { id: 'days', ko: '날짜별' },
    { id: 'stays', ko: '숙소' },
  ];
  readonly kindLabel = STOP_KIND_LABEL;
  readonly reservationLabel = RESERVATION_LABEL;

  readonly trip = computed<Trip | null>(() => (this.store.current()?.id === this.id() ? this.store.current() : null));
  readonly overview = computed(() => (this.trip() ? buildOverview(this.trip()!) : { undecidedDates: true, days: [], unassigned: [], issues: [] }));
  readonly period = computed(() => (this.trip() ? formatPeriod(this.trip()!.startDate, this.trip()!.endDate) : ''));
  readonly isEmptyTrip = computed(() => !!this.trip() && this.trip()!.stops.length === 0 && this.trip()!.stays.length === 0);

  readonly activeTab = computed<Tab>(() => {
    const t = this.tab();
    return t === 'days' || t === 'stays' ? t : 'overview';
  });
  readonly days = computed<IsoDate[]>(() => {
    const t = this.trip();
    return t?.startDate && t.endDate ? enumerateDays(t.startDate, t.endDate) : [];
  });
  readonly selectedDay = computed<IsoDate | null>(() => {
    const d = this.day();
    const days = this.days();
    if (d && days.includes(d)) return d;
    return days[0] ?? null;
  });

  readonly stayInfo = computed(() => dayStayInfo(this.trip()!, this.selectedDay() ?? ''));
  readonly segments = computed(() => (this.selectedDay() ? daySegments(this.trip()!, this.selectedDay()!) : []));
  readonly totals = computed(() => (this.selectedDay() ? dayTotals(this.trip()!, this.selectedDay()!) : dayTotals(this.trip()!, '')));
  readonly conflicts = computed(() => (this.selectedDay() ? fixedTimeConflicts(this.trip()!, this.selectedDay()!) : []));
  readonly dayRegions = computed(() => {
    const d = this.overview().days.find((x) => x.date === this.selectedDay());
    return d?.regionNames ?? [];
  });
  readonly nights = computed(() => (this.trip() ? nightCoverage(this.trip()!) : []));
  readonly issuesMap = computed(() => (this.trip() ? stayIssues(this.trip()!) : new Map<string, string[]>()));
  readonly sortedStays = computed(() => [...(this.trip()?.stays ?? [])].sort((a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0)));

  readonly selectedMarkerId = signal<string | null>(null);
  private readonly emptyMap: DayMapModel = { markers: [], guideLine: [], bounds: null, unverifiedActiveCount: 0, unverifiedStayCount: 0, excludedCount: 0 };
  readonly dayMap = computed<DayMapModel>(() => {
    const t = this.trip();
    const d = this.selectedDay();
    return t && d ? buildDayMap(t, d) : this.emptyMap;
  });
  readonly staysMap = computed<DayMapModel>(() => (this.trip() ? buildStaysMap(this.trip()!) : this.emptyMap));
  readonly flashId = signal<string | null>(null);
  readonly copiedId = signal<string | null>(null);
  readonly copyFallback = signal(false);
  readonly copyFallbackId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      void this.store.open(id);
    });
    effect(() => {
      const day = this.selectedDay();
      if (!day || this.activeTab() !== 'days') return;
      const idx = this.days().indexOf(day);
      queueMicrotask(() => document.querySelector(`[data-testid="daytab-${idx + 1}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    });
  }

  formatDate(d: IsoDate, short = false): string {
    return formatKoreanDate(d, { short });
  }
  minutes(m: number): string {
    return formatMinutes(m);
  }
  summarize(names: string[]): string {
    return names.length <= 4 ? names.join(' → ') : `${names.slice(0, 4).join(' → ')} 외 ${names.length - 4}개`;
  }
  nightCellClass(state: string): string {
    return state === 'covered' ? 'cell--stay' : state === 'conflict' ? 'cell--danger' : state === 'undecided' ? 'cell--warn' : 'cell--ghost';
  }
  regionName(id: string | null): string | null {
    return this.trip()?.regions.find((r) => r.id === id)?.name ?? null;
  }
  stayNames(stays: AccommodationStay[]): string {
    return stays.map((s) => s.name).join(' / ');
  }
  nightCount(s: AccommodationStay): number {
    return stayNightCount(s);
  }
  issuesFor(id: string): string[] {
    return this.issuesMap().get(id) ?? [];
  }
  segKey(seg: { type: string; stop?: TripStop }, i: number): string {
    return seg.type === 'stop' && seg.stop ? 'stop:' + seg.stop.id : 'leg:' + i;
  }
  isConflicted(stopId: string): boolean {
    return this.conflicts().some((c) => c.earlierId === stopId || c.laterId === stopId);
  }
  private stopIndexes(): number[] {
    return this.segments().map((s, i) => (s.type === 'stop' ? i : -1)).filter((i) => i >= 0);
  }
  /** 제외되지 않은 항목의 순번(1부터) */
  stopNumber(idx: number): number {
    return this.segments()
      .slice(0, idx + 1)
      .filter((s) => s.type === 'stop' && !s.stop.excluded).length;
  }
  isFirst(idx: number): boolean {
    return this.stopIndexes()[0] === idx;
  }
  isLast(idx: number): boolean {
    const arr = this.stopIndexes();
    return arr[arr.length - 1] === idx;
  }

  /** 지도 마커 클릭: 해당 카드를 강조하고 화면에 보이게 한다 */
  onMarkerSelect(id: string): void {
    this.selectedMarkerId.set(id);
    const el = document.getElementById('stop-card-' + id) ?? document.getElementById('stay-card-' + id);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** 카드 순번 클릭: 지도 마커를 강조한다(같은 항목 다시 클릭 시 해제) */
  selectStop(id: string): void {
    this.selectedMarkerId.set(this.selectedMarkerId() === id ? null : id);
  }

  naverUrl(stop: TripStop): string {
    return naverSearchUrl(mapQuery(stop.name, stop.address));
  }
  kakaoUrl(stop: TripStop): string {
    return kakaoSearchUrl(mapQuery(stop.name, stop.address));
  }

  async move(stopId: string, dir: 'up' | 'down'): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.store.commit(moveStop(t, stopId, dir));
    this.flashId.set(stopId);
    setTimeout(() => this.flashId.set(null), 320);
  }

  async toggle(stopId: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.store.commit(toggleExcluded(t, stopId));
  }

  async copyAddress(stop: TripStop): Promise<void> {
    const ok = await copyText(stop.address);
    if (ok) {
      this.copiedId.set(stop.id);
      this.copyFallback.set(false);
      setTimeout(() => this.copiedId.set(null), 1500);
    } else {
      this.copyFallback.set(true);
      this.copyFallbackId.set(stop.id);
    }
  }

  onDayKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const days = this.days();
    const cur = days.indexOf(this.selectedDay() ?? '');
    if (cur < 0) return;
    const next = event.key === 'ArrowRight' ? Math.min(days.length - 1, cur + 1) : Math.max(0, cur - 1);
    if (next === cur) return;
    event.preventDefault();
    void this.router.navigate([], { queryParams: { tab: 'days', day: days[next] }, queryParamsHandling: 'merge' }).then(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="daytab-${next + 1}"]`);
      el?.focus();
    });
  }
}
