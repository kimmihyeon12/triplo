import type { Trip } from '../model/trip';

/** 함께 쓰는 여행이면 목록에 '함께 N명'을 붙인다. 혼자 쓰면 붙이지 않는다. */
export function sharedLabel(trip: Trip): string | null {
  const n = trip.sharing?.members.length ?? 0;
  return n > 1 ? `함께 ${n}명` : null;
}

/** 여행 삭제는 주인만 한다. 멤버 정보가 없는 기기 여행은 내 것이다. */
export function canDeleteTrip(trip: Trip): boolean {
  return (trip.sharing?.role ?? 'owner') === 'owner';
}

/** 상단 바의 사람 목록. 서버 여행은 멤버, 기기 여행은 나 한 명. */
export function tripPeople(
  trip: Trip,
  me: { id: string; name: string } | null,
): { id: string; name: string }[] {
  if (trip.sharing) return trip.sharing.members.map((m) => ({ id: m.userId, name: m.nickname || '친구' }));
  return me ? [me] : [];
}
