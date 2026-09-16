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
import { UiBarcode } from '../../../../shared/ui/barcode/barcode';
import { UiPostmark } from '../../../../shared/ui/postmark/postmark';
import { TRIP_REPOSITORY } from '../../../trips/data/trip-repository';
import type { Trip } from '../../../trips/model/trip';
import { itineraryTicket } from '../../../trips/util/itinerary-image';
import { ticketNo as makeTicketNo } from '../../../trips/util/ticket-no';
import { UiTicketTilt } from '../../../../shared/ui/ticket-tilt/ticket-tilt';

@Component({
  selector: 'app-invite',
  templateUrl: './invite.html',
  imports: [RouterLink, UiButton, IconComponent, UiBarcode, UiPostmark, UiTicketTilt],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invite {
  readonly id = input.required<string>();
  readonly trip = signal<Trip | null>(null);
  readonly loading = signal(true);

  /**
   * 티켓 값은 일정 이미지와 같은 함수에서 가져온다. 두 화면이 같은 여행을
   * 같은 표기와 같은 차례로 보여준다.
   */
  readonly ticket = computed(() => {
    const trip = this.trip();
    return trip ? itineraryTicket(trip) : null;
  });

  readonly title = computed(() => this.trip()?.title ?? '여행');
  readonly regionPath = computed(() => this.ticket()?.region ?? '지역 미정');
  readonly fromLabel = computed(() => this.ticket()?.from ?? '어딘가');
  readonly toLabel = computed(() => this.ticket()?.to ?? '어딘가');
  readonly dateLine = computed(() => this.ticket()?.date ?? '날짜 미정');
  readonly dateEndLine = computed(() => this.ticket()?.dateEnd ?? '');
  readonly nights = computed(() => this.ticket()?.period ?? '기간 미정');
  readonly scheduleLabel = computed(() => this.ticket()?.schedule ?? '자유 일정');
  readonly ticketNo = computed(() => this.ticket()?.no ?? makeTicketNo(this.id()));

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

}
