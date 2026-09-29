import { describe, expect, it } from 'vitest';
import { createTrip } from '../../trips/util/factories';
import type { TripRepository } from '../../trips/data/trip-repository';
import { LocalTripMembers, TEST_INVITE_CODE } from './local-trip-members';
import { INVITE_INVALID_MESSAGE } from './trip-members-repository';

function repo(): TripRepository {
  const trip = createTrip({ id: 't1', title: '강릉' });
  return {
    lastSkippedCount: 0,
    list: async () => [trip],
    get: async (id) => (id === 't1' ? trip : null),
    save: async () => undefined,
    remove: async () => undefined,
  };
}

describe('LocalTripMembers', () => {
  it('테스트 코드를 만들고 만료 시각을 기억한다', async () => {
    const members = new LocalTripMembers(repo());
    expect(await members.inviteExpiry('t1')).toBeNull();
    expect(await members.createInvite('t1')).toBe(TEST_INVITE_CODE);
    expect(await members.inviteExpiry('t1')).not.toBeNull();
    await members.revokeInvite('t1');
    expect(await members.inviteExpiry('t1')).toBeNull();
  });

  it('테스트 코드로 이 기기의 첫 여행을 미리 보고 합류한다', async () => {
    const members = new LocalTripMembers(repo());
    expect((await members.preview('test-code')).title).toBe('강릉');
    expect(await members.join('TEST-CODE')).toBe('t1');
    await expect(members.preview('AAAA-AAAA')).rejects.toThrow(INVITE_INVALID_MESSAGE);
  });
});
