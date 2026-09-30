import type { TripRepository } from '../../trips/data/trip-repository';
import type { Trip } from '../../trips/model/trip';
import { normalizeCode } from './invite-code';
import {
  INVITE_INVALID_MESSAGE,
  type InvitePreview,
  type TripMembersRepository,
} from './trip-members-repository';

/** 테스트 앱과 디자인 미리보기가 쓰는 고정 초대 코드. */
export const TEST_INVITE_CODE = 'TESTCODE';

/**
 * 서버 없이 초대 화면·합류 화면을 확인하기 위한 기기 구현. 사용자는 늘 주인이고,
 * 고정 코드는 이 기기의 첫 여행을 가리킨다. 실제 권한은 서버 구현과 SQL 검사가 맡는다.
 */
export class LocalTripMembers implements TripMembersRepository {
  private readonly expiries = new Map<string, string>();

  constructor(private readonly trips: TripRepository) {}

  async createInvite(tripId: string): Promise<string> {
    this.expiries.set(tripId, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    return TEST_INVITE_CODE;
  }

  async revokeInvite(tripId: string): Promise<void> {
    this.expiries.delete(tripId);
  }

  async inviteExpiry(tripId: string): Promise<string | null> {
    return this.expiries.get(tripId) ?? null;
  }

  async preview(code: string): Promise<InvitePreview> {
    return previewOf(await this.target(code));
  }

  async join(code: string): Promise<string> {
    return (await this.target(code)).id;
  }

  async leave(): Promise<void> {}

  async remove(): Promise<void> {}

  private async target(code: string): Promise<Trip> {
    const trip = normalizeCode(code) === TEST_INVITE_CODE ? (await this.trips.list())[0] : undefined;
    if (!trip) throw new Error(INVITE_INVALID_MESSAGE);
    return trip;
  }
}

/** 서버 미리보기와 같은 모양으로 줄인다. 메모·예약·금액·주소는 넣지 않는다. */
function previewOf(trip: Trip): InvitePreview {
  return {
    // 테스트 앱은 초대받은 사람의 흐름을 보여 주므로 아직 멤버가 아닌 것으로 둔다.
    myRole: null,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    ownerNickname: '테스트',
    regions: trip.regions.map((r) => ({ id: r.id, name: r.name, order: r.order })),
    stops: trip.stops
      .filter((s) => !s.excluded)
      .map((s) => ({
        name: s.name,
        kind: s.kind,
        date: s.date,
        order: s.order,
        fixedTime: s.fixedTime,
        regionId: s.regionId,
      })),
    stays: trip.stays.map((s) => ({ name: s.name, checkIn: s.checkIn, checkOut: s.checkOut })),
  };
}
