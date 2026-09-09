import { computed, inject, Injectable, signal } from '@angular/core';
import type { Trip } from '../domain/model';
import { TRIP_REPOSITORY } from './trip-repository';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * 화면과 저장소 사이의 상태 저장소. 저장 실패 시 메모리의 최신 여행을 유지하고 재시도를 제공한다.
 */
@Injectable({ providedIn: 'root' })
export class TripStore {
  private readonly repo = inject(TRIP_REPOSITORY);

  readonly trips = signal<Trip[]>([]);
  readonly listState = signal<LoadState>('idle');
  readonly listError = signal<string | null>(null);
  readonly skippedCount = signal(0);

  readonly current = signal<Trip | null>(null);
  readonly currentState = signal<LoadState>('idle');

  readonly saveState = signal<SaveState>('idle');
  readonly saveError = signal<string | null>(null);
  readonly lastSavedAt = signal<Date | null>(null);
  /** 저장에 실패해 아직 기기에 반영되지 않은 여행 */
  private pending: Trip | null = null;

  readonly hasPending = computed(() => this.saveState() === 'error');

  async loadList(): Promise<void> {
    this.listState.set('loading');
    this.listError.set(null);
    try {
      const trips = await this.repo.list();
      this.trips.set(trips);
      this.skippedCount.set(this.repo.lastSkippedCount);
      this.listState.set('ready');
    } catch (e) {
      this.listError.set(errorMessage(e));
      this.listState.set('error');
    }
  }

  async open(id: string): Promise<Trip | null> {
    // 저장 실패로 메모리에만 있는 여행이면 그것을 우선 보여준다.
    if (this.pending?.id === id) {
      this.current.set(this.pending);
      this.currentState.set('ready');
      return this.pending;
    }
    this.currentState.set('loading');
    try {
      const trip = await this.repo.get(id);
      this.current.set(trip);
      this.currentState.set('ready');
      return trip;
    } catch (e) {
      this.current.set(null);
      this.currentState.set('error');
      this.listError.set(errorMessage(e));
      return null;
    }
  }

  /** 여행을 메모리에 반영하고 기기에 저장한다. 실패해도 메모리 상태는 유지한다. */
  async commit(next: Trip): Promise<boolean> {
    const stamped: Trip = { ...next, updatedAt: new Date().toISOString() };
    this.current.set(stamped);
    this.saveState.set('saving');
    this.saveError.set(null);
    try {
      await this.repo.save(stamped);
      this.pending = null;
      this.saveState.set('saved');
      this.lastSavedAt.set(new Date());
      this.trips.update((list) => [stamped, ...list.filter((t) => t.id !== stamped.id)]);
      return true;
    } catch (e) {
      this.pending = stamped;
      this.saveError.set(errorMessage(e));
      this.saveState.set('error');
      return false;
    }
  }

  async retrySave(): Promise<boolean> {
    const target = this.pending ?? this.current();
    if (!target) return false;
    return this.commit(target);
  }

  async remove(id: string): Promise<boolean> {
    this.saveState.set('saving');
    try {
      await this.repo.remove(id);
      this.trips.update((list) => list.filter((t) => t.id !== id));
      if (this.current()?.id === id) this.current.set(null);
      this.saveState.set('saved');
      this.lastSavedAt.set(new Date());
      return true;
    } catch (e) {
      this.saveError.set(errorMessage(e));
      this.saveState.set('error');
      return false;
    }
  }

  resetSaveState(): void {
    if (this.saveState() !== 'error') this.saveState.set('idle');
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return '알 수 없는 오류';
}
