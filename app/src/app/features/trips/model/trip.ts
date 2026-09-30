import type { GeoPoint, PlaceRef } from '../../places/model/place';
/**
 * 내부 알파 도메인 모델. 화면·저장소 양쪽이 공유한다.
 * 날짜는 모두 'YYYY-MM-DD' 문자열, 시각은 'HH:mm' 문자열이다.
 */

export type IsoDate = string;
export type HHmm = string;

export type StopKind = 'place' | 'activity' | 'meal' | 'break' | 'shopping' | 'other' | 'buffer';
/** AI 코스와 화면이 쓰는 분류. 숙소는 일반 장소가 아니라 stays로 담는다. */
export type PlanKind = Exclude<StopKind, 'buffer'> | 'stay';

/** 장소 추가·수정 화면과 선택 목록의 순서. */
export const STOP_KINDS: readonly StopKind[] = ['place', 'activity', 'meal', 'break', 'shopping', 'other', 'buffer'];
export type ReservationState = 'unknown' | 'reserved' | 'not_reserved';
/** 'verified'는 실제 장소 검색 결과의 좌표를 사용자가 선택한 경우에만 쓴다. 추정 좌표는 만들지 않는다. */
export type LocationStatus = 'unverified' | 'verified';

export interface TripRegion {
  id: string;
  name: string;
  order: number;
  /**
   * 표준 지역 코드(`shared/util/korea-regions`). 통계 집계의 키다.
   *
   * 예전 여행에는 없으므로 선택 항목이다. 없으면 읽는 쪽에서 이름으로
   * 찾아 채운다. 전면 마이그레이션은 실패하면 기존 데이터를 망가뜨리므로
   * 하지 않는다.
   */
  regionCode?: string;
}

export interface TripStop {
  /** 계획 금액(원). 미입력은 미정이며 실제 지출과 별개다. */
  estimatedCost?: number | null;
  id: string;
  kind: StopKind;
  name: string;
  address: string;
  regionId: string | null;
  /** null이면 미배치 */
  date: IsoDate | null;
  order: number;
  /** 체류 계획값(분). null이면 미정 */
  stayMinutes: number | null;
  memo: string;
  /** 사용자가 고정한 시각(예약 등). null이면 없음 */
  fixedTime: HHmm | null;
  /** 일정에서 제외(삭제 아님) */
  excluded: boolean;
  locationStatus: LocationStatus;
  /** 확인된 좌표. 없으면 null(미확인) */
  location: GeoPoint | null;
  placeRef: PlaceRef | null;
}

export interface AccommodationStay {
  /** 숙박 전체 예상 금액(원). */
  estimatedCost?: number | null;
  id: string;
  name: string;
  address: string;
  regionId: string | null;
  checkIn: IsoDate;
  /** 체크아웃 날짜. 숙박 밤은 [checkIn, checkOut) */
  checkOut: IsoDate;
  checkInTime: HHmm | null;
  checkOutTime: HHmm | null;
  /**
   * 체크인 날짜의 일정 목록에서 차지하는 자리. 장소의 order와 같은 축을 쓴다.
   * 숙소가 하루 중간에 들어가는 경우(짐 맡기고 다시 나가는 등)를 표현한다.
   * null이면 그날 맨 끝에 선다.
   */
  dayOrder: number | null;
  reservation: ReservationState;
  memo: string;
  locationStatus: LocationStatus;
  location: GeoPoint | null;
  placeRef: PlaceRef | null;
}

export type TripStatus = 'draft';

/** 여행을 함께 쓰는 사람. 서버 저장에서만 채운다. */
export interface TripMember {
  userId: string;
  nickname: string;
  role: 'owner' | 'editor';
}

/** 서버 여행의 멤버와 나의 역할. 기기 저장 여행에는 없다. */
export interface TripSharing {
  role: 'owner' | 'editor';
  members: TripMember[];
}

export interface Trip {
  id: string;
  title: string;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  regions: TripRegion[];
  stops: TripStop[];
  stays: AccommodationStay[];
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
  /** 서버에서 읽을 때만 채운다. 저장(save_trip)은 이 값을 쓰지 않는다. */
  sharing?: TripSharing;
}

/**
 * 분류 라벨의 유일한 원본. 다른 기능은 자체 표를 두지 않고 이것을 쓴다(2026-09-30 분류 통일).
 * 저장값 'place'는 예전 '장소'이며 라벨만 '관광'으로 바꿨다. 'break'도 라벨만 카페다.
 * 저장값을 바꾸지 않아야 기존 일정이 깨지지 않는다.
 */
export const STOP_KIND_LABEL: Record<StopKind, string> = {
  place: '관광',
  activity: '액티비티',
  meal: '식사',
  break: '카페',
  shopping: '쇼핑',
  other: '기타',
  buffer: '여유시간',
};

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  place: STOP_KIND_LABEL.place,
  activity: STOP_KIND_LABEL.activity,
  meal: STOP_KIND_LABEL.meal,
  break: STOP_KIND_LABEL.break,
  shopping: STOP_KIND_LABEL.shopping,
  other: STOP_KIND_LABEL.other,
  stay: '숙소',
};

/** 저장소·서버에서 읽은 분류. 모르는 값은 관광으로 둔다. 이전 앱이 모르는 값을 만나도 깨지지 않게 한다. */
export function toStopKind(value: unknown): StopKind {
  return (STOP_KINDS as readonly unknown[]).includes(value) ? (value as StopKind) : 'place';
}

/** 통계의 '여행지' 필터에 드는 분류. 먹는 곳과 여유시간이 아닌 모든 장소다. */
export function isSightseeing(kind: StopKind): boolean {
  return kind === 'place' || kind === 'activity' || kind === 'shopping' || kind === 'other';
}

export const STOP_KIND_DEFAULT_NAME: Record<StopKind, string> = {
  place: '',
  activity: '',
  meal: '식사',
  break: '카페',
  shopping: '',
  other: '',
  buffer: '여유시간',
};

export const RESERVATION_LABEL: Record<ReservationState, string> = {
  unknown: '예약 여부 미정',
  reserved: '예약함',
  not_reserved: '미예약',
};
