import { computed, inject, Injectable } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import type { Trip } from '../model/trip';
import { TRIP_REPOSITORY } from './trip-repository';

export interface PendingDraft {
  readonly trip: Trip;
  readonly version: number;
  readonly state: 'saving' | 'error';
  readonly error: string | null;
}

/** Session memory only; survives route destruction, never browser reload. */
@Injectable({ providedIn: 'root' })
export class PendingDraftRegistry {
  private readonly repo = inject(TRIP_REPOSITORY);
  private readonly state = signalState({
    session: 'local',
    generation: 0,
    drafts: {} as Record<string, PendingDraft>,
  });
  private readonly queues = new Map<string, Promise<boolean>>();
  private version = 0;
  private readonly receipts = new Map<string, Date>();
  private readonly savedListeners = new Set<() => void>();
  readonly generation = this.state.generation;
  readonly drafts = computed(() => Object.values(this.state.drafts()));

  get(id: string): PendingDraft | undefined {
    return this.state.drafts()[id];
  }

  savedAt(id: string): Date | null {
    return this.receipts.get(id) ?? null;
  }

  onSaved(listener: () => void): () => void {
    this.savedListeners.add(listener);
    return () => this.savedListeners.delete(listener);
  }

  /** Auth integration calls this before exposing the new user's data. */
  changeSession(session: string): void {
    if (session === this.state.session()) return;
    this.receipts.clear();
    patchState(this.state, { session, generation: this.generation() + 1, drafts: {} });
  }

  discard(id: string): void {
    const { [id]: discarded, ...drafts } = this.state.drafts();
    patchState(this.state, { drafts });
  }

  save(trip: Trip): Promise<boolean> {
    const snapshot = structuredClone(trip);
    const version = ++this.version;
    const generation = this.generation();
    const id = snapshot.id;
    this.put(id, { trip: snapshot, version, state: 'saving', error: null });
    const previous = this.queues.get(id) ?? Promise.resolve(true);
    const operation = previous.then(async () => {
      if (generation !== this.generation()) return false;
      try {
        await this.repo.save(snapshot);
        if (generation !== this.generation()) return false;
        this.receipts.set(id, new Date());
        if (this.get(id)?.version === version) this.discard(id);
        for (const listener of this.savedListeners) listener();
        return true;
      } catch (error) {
        if (generation === this.generation() && this.get(id)?.version === version) {
          this.put(id, { trip: snapshot, version, state: 'error', error: errorMessage(error) });
        }
        return false;
      }
    });
    this.queues.set(id, operation);
    void operation.then(() => {
      if (this.queues.get(id) === operation) this.queues.delete(id);
    });
    return operation;
  }

  private put(id: string, draft: PendingDraft): void {
    patchState(this.state, { drafts: { ...this.state.drafts(), [id]: draft } });
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '알 수 없는 오류';
}
