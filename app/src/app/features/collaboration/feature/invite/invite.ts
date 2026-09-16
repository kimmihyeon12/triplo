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
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { TRIP_REPOSITORY } from '../../../trips/data/trip-repository';
import type { Trip } from '../../../trips/model/trip';
import { dayStops } from '../../../trips/util/itinerary';
import { formatKoreanDate, formatNights } from '../../../../shared/util/dates';

/** 티켓이 기울어지는 최대 각도(도). 넘어가면 종이가 아니라 장난감처럼 보인다. */
const MAX_TILT = 9;

@Component({
  selector: 'app-invite',
  templateUrl: './invite.html',
  imports: [RouterLink, UiButton, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invite {
  readonly id = input.required<string>();
  readonly trip = signal<Trip | null>(null);
  readonly loading = signal(true);

  /** 기울기는 -1~1 범위의 상대 좌표로 들고 있다가 각도로 환산한다. */
  private readonly tilt = signal({ x: 0, y: 0 });
  readonly lifted = signal(false);

  readonly ticketTransform = computed(() => {
    const { x, y } = this.tilt();
    const lift = this.lifted() ? 'translateZ(14px)' : 'translateZ(0)';
    return `rotateX(${(-y * MAX_TILT).toFixed(2)}deg) rotateY(${(x * MAX_TILT).toFixed(2)}deg) ${lift}`;
  });

  /** 빛이 기울인 반대쪽에서 들어오는 것처럼 보이게 한다. */
  readonly sheenTransform = computed(() => {
    const { x, y } = this.tilt();
    return `translate(${(x * 26).toFixed(1)}%, ${(y * 26).toFixed(1)}%)`;
  });

  readonly title = computed(() => this.trip()?.title ?? '여행');

  readonly regionPath = computed(() => {
    const names = this.trip()?.regions.map((r) => r.name) ?? [];
    return names.length > 0 ? names.join(' · ') : '지역 미정';
  });

  /** 출발지·도착지 칸. 지역이 하나면 왕복처럼 같은 곳을 쓴다. */
  readonly fromLabel = computed(() => this.trip()?.regions[0]?.name ?? '어딘가');
  readonly toLabel = computed(() => {
    const names = this.trip()?.regions.map((r) => r.name) ?? [];
    return names[names.length - 1] ?? '어딘가';
  });

  /** 요일은 시작일에만 붙인다. 양쪽에 다 넣으면 좁은 칸에서 잘린다. */
  readonly dateLine = computed(() => {
    const t = this.trip();
    if (!t?.startDate || !t.endDate) return '날짜 미정';
    const [, em, ed] = t.endDate.split('-').map(Number);
    return `${formatKoreanDate(t.startDate, { short: true })} ~ ${em}/${ed}`;
  });

  readonly nights = computed(() => {
    const t = this.trip();
    return t?.startDate && t.endDate ? formatNights(t.startDate, t.endDate) : '기간 미정';
  });

  /** 예약된 숙소 수. 없으면 미정으로 둔다. */
  readonly stayLabel = computed(() => {
    const count = this.trip()?.stays.length ?? 0;
    return count > 0 ? `${count}곳` : '미정';
  });

  /**
   * 항공권의 출발 시각 자리. 첫날 첫 일정의 고정 시각을 쓰고,
   * 정해두지 않았으면 빈칸 대신 일정 규모로 채운다.
   */
  readonly departLabel = computed(() => {
    const t = this.trip();
    if (!t?.startDate) return { value: '미정', unit: '' };
    const first = dayStops(t, t.startDate).find((s) => !s.excluded && s.fixedTime);
    if (first?.fixedTime) return { value: first.fixedTime, unit: '출발' };
    const count = t.stops.filter((s) => !s.excluded).length;
    return count > 0
      ? { value: String(count), unit: '곳 방문' }
      : { value: '자유', unit: '일정' };
  });

  /**
   * 티켓 번호는 여행 id를 숫자로 환산해 만든다. 실제 예약번호가 아니며
   * 같은 여행이면 항상 같은 값이 나온다.
   */
  readonly ticketNo = computed(() => {
    let hash = 0;
    for (const ch of this.id()) hash = (hash * 31 + ch.charCodeAt(0)) % 100000000;
    return String(hash).padStart(8, '0').replace(/(\d{4})(\d{4})/, '$1 $2');
  });

  /**
   * 공유 링크는 서버 저장·권한이 붙어야 만들 수 있다. 지금 기기에만 있는
   * 일정을 가리키는 주소를 건네면 받는 사람에게는 빈 화면이 열린다.
   * 그래서 링크를 만들지 않고 준비 중임을 알린다.
   */
  readonly shareReady = false;

  constructor() {
    const repo = inject(TRIP_REPOSITORY);
    const bar = inject(PageBar);
    effect((cleanup) => {
      let active = true;
      cleanup(() => {
        active = false;
      });
      bar.set({ title: '친구 초대', back: ['/trips', this.id()], action: null });
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

  /**
   * 카드 위 좌표를 -1~1로 환산한다.
   * 터치는 제외한다. 손가락으로 쓰는 동작은 대부분 스크롤 의도라서
   * 기울기가 함께 반응하면 화면이 흔들리는 것처럼 보인다.
   */
  onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.tilt.set({
      x: ((event.clientX - r.left) / r.width) * 2 - 1,
      y: ((event.clientY - r.top) / r.height) * 2 - 1,
    });
    this.lifted.set(true);
  }

  /**
   * 터치 기기에서는 누르는 순간에만 한 번 기울인다.
   * 손을 떼면 돌아오므로 스크롤을 막지 않으면서 반응은 남는다.
   */
  onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.tilt.set({
      x: ((event.clientX - r.left) / r.width) * 2 - 1,
      y: ((event.clientY - r.top) / r.height) * 2 - 1,
    });
    this.lifted.set(true);
  }

  /** 손을 떼면 제자리로 돌아온다. */
  onPointerLeave(): void {
    this.tilt.set({ x: 0, y: 0 });
    this.lifted.set(false);
  }

}
