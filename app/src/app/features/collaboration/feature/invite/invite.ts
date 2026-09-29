import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
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
import { ToastService } from '../../../../core/toast-service';
import { AuthStore } from '../../../auth/data/auth-store';
import { copyText } from '../../../places/data/map-links';
import type { TripMember } from '../../../trips/model/trip';
import { TRIP_MEMBERS } from '../../data/trip-members-repository';
import { inviteLink } from '../../data/invite-code';

@Component({
  selector: 'app-invite',
  templateUrl: './invite.html',
  imports: [UiButton, IconComponent, UiBarcode, UiPostmark, UiTicketTilt],
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

  /** 지역이 한 곳뿐이면 출발·도착을 나누지 않는다. 판단은 티켓이 한다. */
  readonly singleRegion = computed(() => this.ticket()?.singleRegion ?? true);
  readonly dateLine = computed(() => this.ticket()?.date ?? '날짜 미정');
  readonly dateEndLine = computed(() => this.ticket()?.dateEnd ?? '');
  readonly nights = computed(() => this.ticket()?.period ?? '기간 미정');
  readonly scheduleLabel = computed(() => this.ticket()?.schedule ?? '자유 일정');
  readonly ticketNo = computed(() => this.ticket()?.no ?? makeTicketNo(this.id()));

  private readonly members = inject(TRIP_MEMBERS);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly repo = inject(TRIP_REPOSITORY);

  /** 기기 저장 여행(테스트 앱)에는 멤버 정보가 없으므로 나를 주인으로 본다. */
  readonly isOwner = computed(() => (this.trip()?.sharing?.role ?? 'owner') === 'owner');
  readonly memberList = computed<TripMember[]>(
    () =>
      this.trip()?.sharing?.members ?? [
        { userId: this.auth.user()?.id ?? 'me', nickname: this.auth.nickname() ?? '나', role: 'owner' },
      ],
  );
  readonly myId = computed(() => this.auth.user()?.id ?? 'me');

  /** 방금 만든 링크. 서버는 코드의 해시만 두므로 다시 볼 수 없다. */
  readonly link = signal<string | null>(null);
  readonly expiresAt = signal<string | null>(null);
  readonly busy = signal(false);
  /** 빼기·나가기는 한 번 더 눌러야 실행한다. */
  readonly confirming = signal<string | null>(null);

  readonly expiryLabel = computed(() => {
    const at = this.expiresAt();
    if (!at) return '';
    const d = new Date(at);
    return `${d.getMonth() + 1}월 ${d.getDate()}일까지 쓸 수 있어요`;
  });
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  constructor() {
    const bar = inject(PageBar);
    effect((cleanup) => {
      let active = true;
      cleanup(() => {
        active = false;
      });
      bar.set({ title: '친구 초대', back: ['/trips', this.id()], action: null });
      this.loading.set(true);
      this.trip.set(null);
      void this.repo
        .get(this.id())
        .then(async (trip) => {
          if (!active) return;
          this.trip.set(trip);
          this.link.set(null);
          this.confirming.set(null);
          if ((trip?.sharing?.role ?? 'owner') === 'owner')
            this.expiresAt.set(await this.members.inviteExpiry(this.id()).catch(() => null));
        })
        .catch(() => {})
        .finally(() => {
          if (active) this.loading.set(false);
        });
    });
  }

  /** 새 링크를 만든다. 앞 링크는 서버에서 바로 무효가 된다. */
  async createLink(): Promise<void> {
    await this.run(async () => {
      const code = await this.members.createInvite(this.id());
      this.link.set(inviteLink(location.origin, code));
      this.expiresAt.set(await this.members.inviteExpiry(this.id()));
    });
  }

  async revokeLink(): Promise<void> {
    await this.run(async () => {
      await this.members.revokeInvite(this.id());
      this.link.set(null);
      this.expiresAt.set(null);
      this.toast.info('초대 링크를 취소했어요. 이미 받은 링크로는 들어올 수 없어요.');
    });
  }

  async copyLink(): Promise<void> {
    const link = this.link();
    if (!link) return;
    if (await copyText(link)) this.toast.success('초대 링크를 복사했어요. 친구에게 보내 주세요.');
    else this.toast.error('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.');
  }

  async shareLink(): Promise<void> {
    const link = this.link();
    if (!link || !this.canShare) return;
    await navigator.share({ title: `${this.title()} 함께 가요`, url: link }).catch(() => {});
  }

  async removeMember(member: TripMember): Promise<void> {
    if (this.confirming() !== member.userId) {
      this.confirming.set(member.userId);
      return;
    }
    await this.run(async () => {
      await this.members.remove(this.id(), member.userId);
      this.toast.success(`${member.nickname || '친구'}님을 여행에서 뺐어요.`);
      this.trip.set(await this.repo.get(this.id()));
    });
    this.confirming.set(null);
  }

  async leave(): Promise<void> {
    if (this.confirming() !== 'leave') {
      this.confirming.set('leave');
      return;
    }
    await this.run(async () => {
      await this.members.leave(this.id());
      this.toast.success('여행에서 나왔어요.');
      await this.router.navigateByUrl('/trips', { replaceUrl: true });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : '처리하지 못했어요.');
    } finally {
      this.busy.set(false);
    }
  }
}
