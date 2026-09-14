import '@angular/compiler';
import { Injector } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { createTrip } from '../util/factories';
import { type Trip } from '../model/trip';
import { TRIP_REPOSITORY, type TripRepository } from './trip-repository';
import { TripEditorStore } from './trip-editor-store';
import { PendingDraftRegistry } from './pending-draft-registry';
import { TripListStore } from './trip-list-store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(overrides: Partial<TripRepository> = {}) {
  const records = new Map<string, Trip>();
  const repo: TripRepository = {
    lastSkippedCount: 0,
    list: async () => [...records.values()],
    get: async (id) => records.get(id) ?? null,
    save: async (trip) => { records.set(trip.id, trip); },
    remove: async (id) => { records.delete(id); },
    ...overrides,
  };
  const injector = Injector.create({ providers: [TripEditorStore, TripListStore, PendingDraftRegistry, { provide: TRIP_REPOSITORY, useValue: repo }] });
  return { store: injector.get(TripEditorStore), records, injector, pending: injector.get(PendingDraftRegistry), list: injector.get(TripListStore) };
}

describe('trip editing async contract', () => {
  it('refreshes the mounted list when a save completes after navigation', async () => {
    const saving = deferred<void>();
    const { store, records, list } = setup({ save: async (trip) => { await saving.promise; records.set(trip.id, trip); } });
    const work = store.commit(createTrip({ id: 'a', title: 'new trip' }));
    await list.loadList();
    expect(list.trips().map(t => t.title)).toEqual(['new trip']);
    saving.resolve();
    await work;
    await Promise.resolve();
    expect(list.trips().map(t => t.title)).toEqual(['new trip']);
  });

  it('clears private state and rejects commits from a previous session', async () => {
    const saving = deferred<void>();
    const { store, pending, list } = setup({ save: () => saving.promise });
    const trip = createTrip({ id: 'private', title: 'private input' });
    const work = store.commit(trip);
    pending.changeSession('another-user');
    expect(store.current()).toBeNull();
    expect(list.trips()).toEqual([]);
    expect(pending.drafts()).toEqual([]);
    expect(await store.commit(trip)).toBe(false);
    saving.resolve();
    expect(await work).toBe(false);
    expect(store.current()).toBeNull();
  });

  it('restores failed drafts in a newly created workspace instance', async () => {
    const { store, injector } = setup({ save: async () => { throw new Error('full'); } });
    await store.commit(createTrip({ id: 'a', title: 'retained' }));
    const nextWorkspace = Injector.create({ providers: [TripEditorStore], parent: injector });
    const next = nextWorkspace.get(TripEditorStore);
    expect((await next.open('a'))?.title).toBe('retained');
    expect(next.saveState()).toBe('error');
    nextWorkspace.destroy();
    injector.destroy();
  });

  it('ignores reversed list responses', async () => {
    const first = deferred<Trip[]>();
    const second = deferred<Trip[]>();
    let calls = 0;
    const { list } = setup({ list: () => ++calls === 1 ? first.promise : second.promise });
    const old = list.loadList();
    const latest = list.loadList();
    second.resolve([createTrip({ id: 'b' })]);
    await latest;
    first.resolve([createTrip({ id: 'a' })]);
    await old;
    expect(list.trips().map(t => t.id)).toEqual(['b']);
  });
  it('ignores an earlier trip response after another trip opens', async () => {
    const a = deferred<Trip | null>();
    const b = deferred<Trip | null>();
    const { store } = setup({ get: (id) => id === 'a' ? a.promise : b.promise });
    const first = store.open('a');
    const second = store.open('b');
    b.resolve(createTrip({ id: 'b', title: 'B' }));
    await second;
    a.resolve(createTrip({ id: 'a', title: 'A' }));
    await first;
    expect(store.current()?.id).toBe('b');
    expect(store.currentState()).toBe('ready');
  });

  it('serializes writes and keeps the newer edit pending after the older write succeeds', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    let count = 0;
    let persisted = '';
    const { store } = setup({ save: async (trip) => {
      const completion = ++count === 1 ? firstWrite : secondWrite;
      await completion.promise;
      persisted = trip.title;
    } });
    const first = store.commit(createTrip({ id: 'a', title: 'older' }));
    const second = store.commit(createTrip({ id: 'a', title: 'newer' }));
    await Promise.resolve();
    expect(count).toBe(1);
    firstWrite.resolve();
    await first;
    expect(store.current()?.title).toBe('newer');
    expect(store.saveState()).toBe('saving');
    secondWrite.reject(new Error('disk full'));
    expect(await second).toBe(false);
    expect(persisted).toBe('older');
    expect(store.current()?.title).toBe('newer');
    expect(store.saveState()).toBe('error');
  });

  it('retains failed drafts for multiple trips when navigating and retrying', async () => {
    let fail = true;
    const { store, records } = setup({ save: async (trip) => {
      if (fail) throw new Error('disk full');
      records.set(trip.id, trip);
    } });
    await store.commit(createTrip({ id: 'a', title: 'A unsaved' }));
    await store.commit(createTrip({ id: 'b', title: 'B unsaved' }));
    expect((await store.open('a'))?.title).toBe('A unsaved');
    fail = false;
    expect(await store.retrySave()).toBe(true);
    expect(records.get('a')?.title).toBe('A unsaved');
    expect((await store.open('b'))?.title).toBe('B unsaved');
    expect(store.saveState()).toBe('error');
  });

  it('does not apply a previous trip save status to the newly opened trip', async () => {
    const saving = deferred<void>();
    const { store } = setup({ save: () => saving.promise, get: async (id) => createTrip({ id }) });
    const first = store.commit(createTrip({ id: 'a' }));
    await store.open('b');
    saving.reject(new Error('A failed'));
    await first;
    expect(store.current()?.id).toBe('b');
    expect(store.saveState()).toBe('idle');
    expect(store.saveError()).toBeNull();
  });
});
