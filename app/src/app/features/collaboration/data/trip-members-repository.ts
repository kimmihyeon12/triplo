import { InjectionToken } from '@angular/core';

/** 로그인 전에도 보는 초대 미리보기. 메모·예약·금액·주소·가계부는 없다. */
export interface InvitePreview {
  title: string;
  startDate: string | null;
  endDate: string | null;
  ownerNickname: string;
  regions: { id: string; name: string; order: number }[];
  stops: {
    name: string;
    kind: string;
    date: string | null;
    order: number;
    fixedTime: string | null;
    regionId: string | null;
  }[];
  stays: { name: string; checkIn: string; checkOut: string }[];
}

/** 초대·합류·멤버 관리. 실행 앱은 서버, 테스트·미리보기는 기기 구현을 쓴다. */
export interface TripMembersRepository {
  /** 새 초대 코드를 만든다(앞 링크는 무효). 주인만. */
  createInvite(tripId: string): Promise<string>;
  revokeInvite(tripId: string): Promise<void>;
  /** 살아 있는 초대의 만료 시각(ISO). 없으면 null. 주인만 볼 수 있다. */
  inviteExpiry(tripId: string): Promise<string | null>;
  preview(code: string): Promise<InvitePreview>;
  /** 합류하고 여행 id를 돌려준다. */
  join(code: string): Promise<string>;
  leave(tripId: string): Promise<void>;
  remove(tripId: string, userId: string): Promise<void>;
}

export const TRIP_MEMBERS = new InjectionToken<TripMembersRepository>('TRIP_MEMBERS');

export const INVITE_INVALID_MESSAGE =
  '초대 링크가 올바르지 않거나 만료됐어요. 여행을 만든 친구에게 새 링크를 받아 주세요.';
