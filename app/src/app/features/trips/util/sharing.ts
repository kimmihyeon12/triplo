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

/**
 * 가계부에서 '나'를 가리키는 사람 칸. 주인과 기기 여행은 'self', 초대로 합류한
 * 친구는 서버가 합류 때 만든 'member-아이디'다. 결제자 기본값에 쓴다.
 */
export function myLedgerPersonId(trip: Trip, userId: string | null): string {
  return trip.sharing?.role === 'editor' && userId ? `member-${userId}` : 'self';
}
