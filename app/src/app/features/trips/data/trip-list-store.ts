import { computed, DestroyRef, inject, Injectable, untracked } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import type { Trip } from '../model/trip';
import { TRIP_REPOSITORY } from './trip-repository';
import { errorMessage, PendingDraftRegistry } from './pending-draft-registry';
import { ToastService } from '../../../core/toast-service';

@Injectable()
export class TripListStore {
  private readonly repo = inject(TRIP_REPOSITORY);
  private readonly pending = inject(PendingDraftRegistry);
  private readonly toast = inject(ToastService);
  private readonly state = signalState({
    trips: [] as Trip[],
    listState: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    listError: null as string | null,
    skippedCount: 0,
    generation: this.pending.generation(),
  });
  private request = 0;

  constructor() {
    inject(DestroyRef).onDestroy(
      this.pending.onSaved(() => {
        void this.loadList();
      }),
    );
  }

  private readonly sessionMatches = computed(
    () => this.state.generation() === this.pending.generation(),
  );
  readonly listState = computed(() => (this.sessionMatches() ? this.state.listState() : 'idle'));
  readonly listError = computed(() => (this.sessionMatches() ? this.state.listError() : null));
  readonly skippedCount = computed(() => (this.sessionMatches() ? this.state.skippedCount() : 0));
  readonly trips = computed(() => {
    if (!this.sessionMatches()) return [];
    const pending = this.pending.drafts().map((d) => d.trip);
    const ids = new Set(pending.map((t) => t.id));
    return [...pending, ...this.state.trips().filter((t) => !ids.has(t.id))];
  });

  /**
   * 화면이 그릴 모양. 불러오기가 끝나기 전에는 빈 목록 화면도 목록 화면도
   * 그리지 않는다. 서버 저장은 불러오는 데 시간이 걸려, 그사이 목록 화면
   * (만들기 버튼·다녀온 곳 지도)을 먼저 그렸다가 빈 목록 화면으로 바뀌는
   * 깜박임이 있었다.
   */
  readonly view = computed<'pending' | 'empty' | 'list'>(() =>
    this.listState() !== 'ready' ? 'pending' : this.trips().length ? 'list' : 'empty',
  );

  loadList(): Promise<void> {
    return untracked(() => this.load());
  }

  /** 여행 하나를 지운다. 성공하면 목록을 다시 읽는다. */
  async removeTrip(id: string): Promise<boolean> {
    try {
      await this.repo.remove(id);
      // 저장에 실패해 남은 초안이 있으면 목록이 그것을 앞에 붙여 지운 여행이 되살아난다.
      this.pending.discard(id);
      await this.loadList();
      return true;
    } catch (error) {
      patchState(this.state, { listError: errorMessage(error) });
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  private async load(): Promise<void> {
    const request = ++this.request;
    const generation = this.pending.generation();
    patchState(this.state, { generation, listState: 'loading', listError: null });
    try {
      const trips = await this.repo.list();
      if (request !== this.request || generation !== this.pending.generation()) return;
      patchState(this.state, {
        trips,
        skippedCount: this.repo.lastSkippedCount,
        listState: 'ready',
      });
    } catch (error) {
      if (request === this.request && generation === this.pending.generation()) {
        patchState(this.state, { listState: 'error', listError: errorMessage(error) });
        this.toast.error(errorMessage(error));
      }
    }
  }
}
