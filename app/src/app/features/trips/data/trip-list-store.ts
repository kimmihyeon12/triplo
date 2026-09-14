import { computed, DestroyRef, inject, Injectable, untracked } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import type { Trip } from '../model/trip';
import { TRIP_REPOSITORY } from './trip-repository';
import { errorMessage, PendingDraftRegistry } from './pending-draft-registry';

@Injectable()
export class TripListStore {
  private readonly repo = inject(TRIP_REPOSITORY);
  private readonly pending = inject(PendingDraftRegistry);
  private readonly state = signalState({ trips: [] as Trip[], listState: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    listError: null as string | null, skippedCount: 0, generation: this.pending.generation() });
  private request = 0;
  constructor() {
    inject(DestroyRef).onDestroy(this.pending.onSaved(() => { void this.loadList(); }));
  }
  private readonly sessionMatches = computed(() => this.state.generation() === this.pending.generation());
  readonly listState = computed(() => this.sessionMatches() ? this.state.listState() : 'idle');
  readonly listError = computed(() => this.sessionMatches() ? this.state.listError() : null);
  readonly skippedCount = computed(() => this.sessionMatches() ? this.state.skippedCount() : 0);
  readonly trips = computed(() => {
    if (!this.sessionMatches()) return [];
    const pending = this.pending.drafts().map((d) => d.trip);
    const ids = new Set(pending.map((t) => t.id));
    return [...pending, ...this.state.trips().filter((t) => !ids.has(t.id))];
  });

  loadList(): Promise<void> { return untracked(() => this.load()); }

  private async load(): Promise<void> {
    const request = ++this.request;
    const generation = this.pending.generation();
    patchState(this.state, { generation, listState: 'loading', listError: null });
    try {
      const trips = await this.repo.list();
      if (request !== this.request || generation !== this.pending.generation()) return;
      patchState(this.state, { trips, skippedCount: this.repo.lastSkippedCount, listState: 'ready' });
    } catch (error) {
      if (request === this.request && generation === this.pending.generation()) {
        patchState(this.state, { listState: 'error', listError: errorMessage(error) });
      }
    }
  }
}
