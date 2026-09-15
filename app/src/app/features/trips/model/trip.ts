import type { GeoPoint, PlaceRef } from '../../places/model/place';
/**
 * 내부 알파 도메인 모델. 화면·저장소 양쪽이 공유한다.
 * 날짜는 모두 'YYYY-MM-DD' 문자열, 시각은 'HH:mm' 문자열이다.
 */

export type IsoDate = string;
export type HHmm = string;

export type StopKind = 'place' | 'meal' | 'break' | 'buffer';
export type ReservationState = 'unknown' | 'reserved' | 'not_reserved';
/** 'verified'는 실제 장소 검색 결과의 좌표를 사용자가 선택한 경우에만 쓴다. 추정 좌표는 만들지 않는다. */
export type LocationStatus = 'unverified' | 'verified';

export interface TripRegion {
  id: string;
  name: string;
  order: number;
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
}

export const STOP_KIND_LABEL: Record<StopKind, string> = {
  place: '장소',
  meal: '식사',
  // 저장값은 'break'를 유지한다. 라벨만 바꿔 기존 일정이 깨지지 않게 한다.
  break: '카페',
  buffer: '여유시간',
};

export const STOP_KIND_DEFAULT_NAME: Record<StopKind, string> = {
  place: '',
  meal: '식사',
  break: '카페',
  buffer: '여유시간',
};

export const RESERVATION_LABEL: Record<ReservationState, string> = {
  unknown: '예약 여부 미정',
  reserved: '예약함',
  not_reserved: '미예약',
};
