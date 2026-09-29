import '@angular/compiler';
import { Injector } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { createTrip } from '../util/factories';
import { PendingDraftRegistry, sessionWatcher } from './pending-draft-registry';
import { TRIP_REPOSITORY, type TripRepository } from './trip-repository';
import { ErrorToastService } from '../../../core/error-toast-service';

describe('PendingDraftRegistry 계정 전환', () => {
  it('다른 계정으로 바뀌면 이전 계정의 실패 초안을 버린다', async () => {
    const repo: TripRepository = {
      lastSkippedCount: 0,
      list: async () => [],
      get: async () => null,
      save: async () => {
        throw new Error('offline');
      },
      remove: async () => undefined,
    };
    const pending = Injector.create({
      providers: [
        PendingDraftRegistry,
        ErrorToastService,
        { provide: TRIP_REPOSITORY, useValue: repo },
      ],
    }).get(PendingDraftRegistry);
    pending.changeSession('user-a');
    const trip = createTrip();
    await pending.save(trip);
    expect(pending.get(trip.id)?.state).toBe('error');
    pending.changeSession('user-b');
    expect(pending.get(trip.id)).toBeUndefined();
  });
});

describe('sessionWatcher', () => {
  it('로그인 복원이 끝난 뒤 첫 계정은 기준으로만 삼고, 실제로 바뀔 때만 알린다', () => {
    const changes: string[] = [];
    const watch = sessionWatcher((id) => changes.push(id));
    watch(true, null);
    watch(false, 'user-a');
    watch(false, 'user-a');
    expect(changes).toEqual([]);
    watch(false, null);
    watch(false, 'user-b');
    expect(changes).toEqual(['signed-out', 'user-b']);
  });
});

describe('저장 실패 알림', () => {
  it('저장에 실패하면 오류 토스트로 알린다', async () => {
    const repo: TripRepository = {
      lastSkippedCount: 0,
      list: async () => [],
      get: async () => null,
      save: async () => {
        throw new Error('서버에 저장하지 못했어요.');
      },
      remove: async () => undefined,
    };
    const injector = Injector.create({
      providers: [
        PendingDraftRegistry,
        ErrorToastService,
        { provide: TRIP_REPOSITORY, useValue: repo },
      ],
    });
    await injector.get(PendingDraftRegistry).save(createTrip());
    expect(injector.get(ErrorToastService).message()).toBe('서버에 저장하지 못했어요.');
  });
});
