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
import { ToastService } from '../../../../core/toast-service';
import { UiButton } from '../../../../shared/ui/button/button';
import { AuthStore } from '../../../auth/data/auth-store';
import { rememberReturn } from '../../../auth/util/return-to';
import { itinerarySections, itineraryTicket } from '../../../trips/util/itinerary-image';
import { ItinerarySnapshot } from '../../../trips/ui/itinerary-snapshot/itinerary-snapshot';
import { formatCode } from '../../data/invite-code';
import { TRIP_MEMBERS, type InvitePreview } from '../../data/trip-members-repository';
import { tripFromPreview } from '../../util/preview-trip';

/**
 * 초대 링크로 여는 화면. 로그인 없이도 일정을 볼 수 있고(보기 전용),
 * 로그인했으면 [함께하기]로 여행 멤버가 된다. 로그인하지 않았으면 로그인과
 * 닉네임 설정을 마친 뒤 이 주소로 돌아온다.
 */
@Component({
  selector: 'app-join',
  templateUrl: './join.html',
  imports: [UiButton, ItinerarySnapshot],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Join {
  readonly code = input.required<string>();
  private readonly members = inject(TRIP_MEMBERS);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly state = signal<'loading' | 'ready' | 'invalid'>('loading');
  readonly invalidMessage = signal('');
  readonly preview = signal<InvitePreview | null>(null);
  readonly busy = signal(false);
  readonly signedIn = computed(() => !!this.auth.user());
  /** 세션을 불러오는 동안에는 버튼을 보이지 않는다. 로그인 버튼이 잠깐 스치면 헷갈린다. */
  readonly authReady = computed(() => !this.auth.loading());

  private readonly trip = computed(() => {
    const p = this.preview();
    return p ? tripFromPreview(p) : null;
  });
  readonly ticket = computed(() => {
    const t = this.trip();
    return t ? itineraryTicket(t) : null;
  });
  readonly sections = computed(() => {
    const t = this.trip();
    return t ? itinerarySections(t) : [];
  });

  constructor() {
    // 이 화면에는 로그인 가드가 없어 세션을 스스로 불러온다. 부르지 않으면
    // 로그인한 사람도 로그인 전으로 보여 [함께하기] 대신 로그인 버튼이 뜬다.
    void this.auth.initialize();
    const bar = inject(PageBar);
    effect((cleanup) => {
      let active = true;
      cleanup(() => {
        active = false;
      });
      bar.set({ title: '여행 초대', back: null, action: null });
      this.state.set('loading');
      void this.members
        .preview(this.code())
        .then((preview) => {
          if (!active) return;
          this.preview.set(preview);
          this.state.set('ready');
        })
        .catch((error: unknown) => {
          if (!active) return;
          this.invalidMessage.set(error instanceof Error ? error.message : '초대를 열지 못했어요.');
          this.state.set('invalid');
        });
    });
  }

  async join(): Promise<void> {
    if (this.busy()) return;
    // 닉네임이 없으면 멤버 목록에 이름이 비므로 닉네임부터 정한다.
    if (!this.auth.nickname()) {
      rememberReturn(this.path());
      await this.router.navigateByUrl('/onboarding');
      return;
    }
    this.busy.set(true);
    try {
      const tripId = await this.members.join(this.code());
      this.toast.success('여행에 함께하게 됐어요. 일정과 가계부를 함께 고칠 수 있어요.');
      await this.router.navigateByUrl(`/trips/${tripId}`, { replaceUrl: true });
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : '함께하지 못했어요.');
    } finally {
      this.busy.set(false);
    }
  }

  async loginToJoin(): Promise<void> {
    rememberReturn(this.path());
    await this.router.navigateByUrl('/login');
  }

  private path(): string {
    return `/join/${formatCode(this.code())}`;
  }
}
