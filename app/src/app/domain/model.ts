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

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** 외부 장소 제공자 참조. 좌표와 함께 보존해 이후 상세 조회·경로 계산에 쓴다. */
export interface PlaceRef {
  provider: 'kakao' | 'fixture';
  id: string;
  url: string | null;
}

export interface TripRegion {
  id: string;
  name: string;
  order: number;
}

export interface TripStop {
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
  id: string;
  name: string;
  address: string;
  regionId: string | null;
  checkIn: IsoDate;
  /** 체크아웃 날짜. 숙박 밤은 [checkIn, checkOut) */
  checkOut: IsoDate;
  checkInTime: HHmm | null;
  checkOutTime: HHmm | null;
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
  break: '휴식',
  buffer: '여유시간',
};

export const STOP_KIND_DEFAULT_NAME: Record<StopKind, string> = {
  place: '',
  meal: '식사',
  break: '휴식',
  buffer: '여유시간',
};

export const RESERVATION_LABEL: Record<ReservationState, string> = {
  unknown: '예약 여부 미정',
  reserved: '예약함',
  not_reserved: '미예약',
};

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function createTrip(partial: Partial<Trip> = {}): Trip {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? newId(),
    title: partial.title?.trim() || '새 여행',
    startDate: partial.startDate ?? null,
    endDate: partial.endDate ?? null,
    regions: partial.regions ?? [],
    stops: partial.stops ?? [],
    stays: partial.stays ?? [],
    status: 'draft',
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    schemaVersion: 1,
  };
}

export function createStop(partial: Partial<TripStop> & { kind?: StopKind }): TripStop {
  const kind = partial.kind ?? 'place';
  return {
    id: partial.id ?? newId(),
    kind,
    name: (partial.name ?? '').trim() || STOP_KIND_DEFAULT_NAME[kind],
    address: partial.address ?? '',
    regionId: partial.regionId ?? null,
    date: partial.date ?? null,
    order: partial.order ?? 0,
    stayMinutes: partial.stayMinutes ?? null,
    memo: partial.memo ?? '',
    fixedTime: partial.fixedTime ?? null,
    excluded: partial.excluded ?? false,
    location: partial.location ?? null,
    placeRef: partial.placeRef ?? null,
    locationStatus: partial.location ? 'verified' : 'unverified',
  };
}

export function createStay(partial: Partial<AccommodationStay> & { checkIn: IsoDate; checkOut: IsoDate }): AccommodationStay {
  return {
    id: partial.id ?? newId(),
    name: (partial.name ?? '').trim(),
    address: partial.address ?? '',
    regionId: partial.regionId ?? null,
    checkIn: partial.checkIn,
    checkOut: partial.checkOut,
    checkInTime: partial.checkInTime ?? null,
    checkOutTime: partial.checkOutTime ?? null,
    reservation: partial.reservation ?? 'unknown',
    memo: partial.memo ?? '',
    location: partial.location ?? null,
    placeRef: partial.placeRef ?? null,
    locationStatus: partial.location ? 'verified' : 'unverified',
  };
}

export function createRegion(name: string, order: number, id?: string): TripRegion {
  return { id: id ?? newId(), name: name.trim(), order };
}
