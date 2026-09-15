import { computed, inject, Injectable, untracked } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import type { Trip } from '../model/trip';
import { TRIP_REPOSITORY } from './trip-repository';
import { errorMessage, PendingDraftRegistry } from './pending-draft-registry';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Provided by the trip workspace and shared by detail/stop/stay child routes. */
@Injectable()
export class TripEditorStore {
  private readonly repo = inject(TRIP_REPOSITORY);
  private readonly pending = inject(PendingDraftRegistry);
  private readonly state = signalState({
    id: null as string | null,
    current: null as Trip | null,
    currentState: 'idle' as LoadState,
    currentError: null as string | null,
    saveState: 'idle' as SaveState,
    lastSavedAt: null as Date | null,
    generation: this.pending.generation(),
  });
  private request = 0;
  private editVersion = 0;
  private readonly sessionMatches = computed(
    () => this.state.generation() === this.pending.generation(),
  );
  private readonly draft = computed(() =>
    this.sessionMatches() && this.state.id() ? this.pending.get(this.state.id()!) : undefined,
  );
  readonly current = computed(() =>
    this.sessionMatches() ? (this.draft()?.trip ?? this.state.current()) : null,
  );
  readonly currentState = computed(() =>
    this.sessionMatches() ? this.state.currentState() : 'idle',
  );
  readonly currentError = computed(() =>
    this.sessionMatches() ? this.state.currentError() : null,
  );
  readonly saveState = computed<SaveState>(() =>
    this.sessionMatches() ? (this.draft()?.state ?? this.state.saveState()) : 'idle',
  );
  readonly saveError = computed(() => this.draft()?.error ?? null);
  readonly lastSavedAt = computed(() => (this.sessionMatches() ? this.state.lastSavedAt() : null));
  readonly hasPending = computed(() => !!this.draft());

  open(id: string): Promise<Trip | null> {
    return untracked(() => this.load(id));
  }

  private async load(id: string): Promise<Trip | null> {
    const request = ++this.request;
    const generation = this.pending.generation();
    const pending = this.pending.get(id);
    const savedAt = this.pending.savedAt(id);
    if (this.state.id() === id && this.sessionMatches() && this.currentState() === 'ready')
      return this.current();
    patchState(this.state, {
      id,
      generation,
      current: pending?.trip ?? null,
      currentState: pending ? 'ready' : 'loading',
      currentError: null,
      saveState: pending || savedAt ? 'saved' : 'idle',
      lastSavedAt: savedAt,
    });
    if (pending) return pending.trip;
    try {
      const trip = await this.repo.get(id);
      if (request !== this.request || generation !== this.pending.generation()) return null;
      patchState(this.state, { current: trip, currentState: 'ready' });
      return trip;
    } catch (error) {
      if (request === this.request && generation === this.pending.generation()) {
        patchState(this.state, {
          current: null,
          currentState: 'error',
          currentError: errorMessage(error),
        });
      }
      return null;
    }
  }

  /** 지금 열려 있는 여행을 지운다. 성공하면 화면이 목록으로 이동한다. */
  async removeCurrent(): Promise<boolean> {
    const id = this.state.id();
    if (!id) return false;
    try {
      await this.repo.remove(id);
      return true;
    } catch (error) {
      patchState(this.state, { currentError: errorMessage(error) });
      return false;
    }
  }

  async commit(next: Trip): Promise<boolean> {
    if (!this.sessionMatches()) return false;
    ++this.request;
    const version = ++this.editVersion;
    const generation = this.pending.generation();
    const stamped: Trip = structuredClone({ ...next, updatedAt: new Date().toISOString() });
    patchState(this.state, {
      id: stamped.id,
      generation,
      current: stamped,
      currentState: 'ready',
      currentError: null,
      saveState: 'saving',
    });
    const ok = await this.pending.save(stamped);
    if (
      version === this.editVersion &&
      generation === this.pending.generation() &&
      this.state.id() === stamped.id
    ) {
      patchState(this.state, {
        saveState: ok ? 'saved' : 'error',
        lastSavedAt: ok ? new Date() : this.state.lastSavedAt(),
      });
    }
    return ok;
  }

  retrySave(): Promise<boolean> {
    const trip = this.current();
    return trip ? this.commit(trip) : Promise.resolve(false);
  }
}
