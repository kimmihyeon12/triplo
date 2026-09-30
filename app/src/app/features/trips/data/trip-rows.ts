import { toStopKind, type AccommodationStay, type Trip, type TripRegion, type TripSharing, type TripStop } from '../model/trip';
import type { PlaceRef } from '../../places/model/place';

/**
 * Supabase 표의 행과 앱 모델 사이의 변환. 저장은 앱 모델 JSON을 그대로
 * save_trip에 보내므로 여기서는 읽기 방향만 다룬다.
 */
export interface RegionRow {
  id: string;
  name: string;
  order: number;
  region_code: string | null;
}

export interface StopRow {
  id: string;
  region_id: string | null;
  kind: TripStop['kind'];
  name: string;
  address: string;
  date: string | null;
  order: number;
  stay_minutes: number | null;
  memo: string;
  fixed_time: string | null;
  excluded: boolean;
  location_status: TripStop['locationStatus'];
  lat: number | null;
  lng: number | null;
  place_provider: string | null;
  place_id: string | null;
  place_url: string | null;
  estimated_cost: number | null;
}

export interface StayRow {
  id: string;
  region_id: string | null;
  name: string;
  address: string;
  check_in: string;
  check_out: string;
  check_in_time: string | null;
  check_out_time: string | null;
  day_order: number | null;
  reservation: AccommodationStay['reservation'];
  memo: string;
  location_status: AccommodationStay['locationStatus'];
  lat: number | null;
  lng: number | null;
  place_provider: string | null;
  place_id: string | null;
  place_url: string | null;
  estimated_cost: number | null;
}

export interface MemberRow {
  user_id: string;
  role: 'owner' | 'editor';
  nickname: string;
  joined_at: string;
}

export interface TripRow {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: 'draft';
  schema_version: number;
  created_at: string;
  updated_at: string;
  version: number;
  owner_id?: string;
  trip_members?: MemberRow[];
  trip_regions: RegionRow[];
  trip_stops: StopRow[];
  accommodation_stays: StayRow[];
}

/** 목록·한 개 읽기에 같은 모양을 쓰도록 select 문자열을 한곳에 둔다. */
export const TRIP_SELECT =
  '*, trip_regions(*), trip_stops(*), accommodation_stays(*), trip_members(user_id, role, nickname, joined_at)';

function location(lat: number | null, lng: number | null) {
  return lat === null || lng === null ? null : { lat, lng };
}

function placeRef(
  provider: string | null,
  id: string | null,
  url: string | null,
): PlaceRef | null {
  if (!provider || !id) return null;
  return { provider: provider as PlaceRef['provider'], id, url };
}

/** 멤버는 주인 먼저, 그다음 합류한 순서로 보인다. */
function sharingFromRow(row: TripRow, me: string | null): TripSharing | undefined {
  if (!row.trip_members?.length) return undefined;
  const members = [...row.trip_members]
    .sort((a, b) =>
      a.role === b.role ? a.joined_at.localeCompare(b.joined_at) : a.role === 'owner' ? -1 : 1,
    )
    .map((m) => ({ userId: m.user_id, nickname: m.nickname, role: m.role }));
  return { role: row.owner_id !== undefined && row.owner_id === me ? 'owner' : 'editor', members };
}

export function tripFromRow(row: TripRow, me: string | null = null): Trip {
  const regions: TripRegion[] = [...row.trip_regions]
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      id: r.id,
      name: r.name,
      order: r.order,
      ...(r.region_code ? { regionCode: r.region_code } : {}),
    }));
  const stops: TripStop[] = row.trip_stops.map((s) => ({
    id: s.id,
    kind: toStopKind(s.kind),
    name: s.name,
    address: s.address,
    regionId: s.region_id,
    date: s.date,
    order: s.order,
    stayMinutes: s.stay_minutes,
    memo: s.memo,
    fixedTime: s.fixed_time,
    excluded: s.excluded,
    locationStatus: s.location_status,
    location: location(s.lat, s.lng),
    placeRef: placeRef(s.place_provider, s.place_id, s.place_url),
    estimatedCost: s.estimated_cost,
  }));
  const stays: AccommodationStay[] = row.accommodation_stays.map((a) => ({
    id: a.id,
    name: a.name,
    address: a.address,
    regionId: a.region_id,
    checkIn: a.check_in,
    checkOut: a.check_out,
    checkInTime: a.check_in_time,
    checkOutTime: a.check_out_time,
    dayOrder: a.day_order,
    reservation: a.reservation,
    memo: a.memo,
    locationStatus: a.location_status,
    location: location(a.lat, a.lng),
    placeRef: placeRef(a.place_provider, a.place_id, a.place_url),
    estimatedCost: a.estimated_cost,
  }));
  const sharing = sharingFromRow(row, me);
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    regions,
    stops,
    stays,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: 1,
    ...(sharing ? { sharing } : {}),
  };
}
