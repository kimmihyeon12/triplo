import {
  STOP_KIND_DEFAULT_NAME,
  type Trip,
  type TripStop,
  type AccommodationStay,
  type TripRegion,
  type StopKind,
  type IsoDate,
} from '../model/trip';

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
    estimatedCost: partial.estimatedCost ?? null,
    fixedTime: partial.fixedTime ?? null,
    excluded: partial.excluded ?? false,
    location: partial.location ?? null,
    placeRef: partial.placeRef ?? null,
    locationStatus: partial.location ? 'verified' : 'unverified',
  };
}

export function createStay(
  partial: Partial<AccommodationStay> & { checkIn: IsoDate; checkOut: IsoDate },
): AccommodationStay {
  return {
    id: partial.id ?? newId(),
    name: (partial.name ?? '').trim(),
    address: partial.address ?? '',
    regionId: partial.regionId ?? null,
    checkIn: partial.checkIn,
    checkOut: partial.checkOut,
    checkInTime: partial.checkInTime ?? null,
    checkOutTime: partial.checkOutTime ?? null,
    dayOrder: partial.dayOrder ?? null,
    reservation: partial.reservation ?? 'unknown',
    memo: partial.memo ?? '',
    estimatedCost: partial.estimatedCost ?? null,
    location: partial.location ?? null,
    placeRef: partial.placeRef ?? null,
    locationStatus: partial.location ? 'verified' : 'unverified',
  };
}

export function createRegion(name: string, order: number, id?: string): TripRegion {
  return { id: id ?? newId(), name: name.trim(), order };
}
