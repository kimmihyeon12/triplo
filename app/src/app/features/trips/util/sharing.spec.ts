import { describe, expect, it } from 'vitest';
import { createTrip } from './factories';
import { canDeleteTrip, myLedgerPersonId, sharedLabel, tripPeople } from './sharing';

const shared = {
  ...createTrip(),
  sharing: {
    role: 'editor' as const,
    members: [
      { userId: 'u1', nickname: '주인', role: 'owner' as const },
      { userId: 'u2', nickname: '민지', role: 'editor' as const },
    ],
  },
};

describe('sharing', () => {
  it('멤버가 둘 이상이면 함께 라벨을 붙인다', () => {
    expect(sharedLabel(shared)).toBe('함께 2명');
    expect(sharedLabel(createTrip())).toBeNull();
  });

  it('주인만 여행을 지운다. 기기 여행은 내 것이다', () => {
    expect(canDeleteTrip(shared)).toBe(false);
    expect(canDeleteTrip(createTrip())).toBe(true);
  });

  it('상단 사람 목록은 멤버로, 멤버 정보가 없으면 나 한 명으로', () => {
    expect(tripPeople(shared, null)).toEqual([
      { id: 'u1', name: '주인' },
      { id: 'u2', name: '민지' },
    ]);
    expect(tripPeople(createTrip(), { id: 'me', name: '나' })).toEqual([{ id: 'me', name: '나' }]);
    expect(tripPeople(createTrip(), null)).toEqual([]);
  });

  it('가계부의 내 칸: 주인·기기 여행은 self, 합류한 친구는 member-아이디', () => {
    expect(myLedgerPersonId(shared, 'u2')).toBe('member-u2');
    expect(myLedgerPersonId({ ...shared, sharing: { ...shared.sharing, role: 'owner' as const } }, 'u1')).toBe('self');
    expect(myLedgerPersonId(createTrip(), 'u1')).toBe('self');
    expect(myLedgerPersonId(shared, null)).toBe('self');
  });
});
