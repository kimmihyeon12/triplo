import { addDays, diffDays, isIsoDate } from '../../../shared/util/dates';
import { createStop } from '../../trips/util/factories';
import { appendStop, haversineKm, placeStopOnDate, removeStop } from '../../trips/util/itinerary';
import { regionIdForAddress } from '../../trips/util/region-match';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip, TripStop } from '../../trips/model/trip';
import type { ChatDraft } from '../model/chat';
import { describeStop, localChangeValid } from './local-command-draft';

/**
 * 확인 카드에 보여줄 '바뀌기 전과 후', 그리고 그것을 실제 일정에 반영하는 일.
 *
 * 거리 계산은 저장된 좌표로 앱이 직접 한다. 모델은 순서를 바꿔 달라는 의도만
 * 해석하며, 몇 km가 줄어드는지는 말하지 않는다. 모델이 낸 숫자를 그대로
 * 보여주면 사용자가 확인할 방법이 없다.
 */

/** 확인 카드의 한 줄. 무엇이 더해지고 빠지는지 표시한다. */
export interface DraftRow {
  readonly id: string;
  readonly name: string;
  /** 이번 변경으로 새로 들어오는 줄. */
  readonly added: boolean;
  /** 이번 변경으로 빠지는 줄. '전' 쪽에만 붙는다. */
  readonly removed: boolean;
}

export interface DraftPreview {
  /** Local edits contain values that must remain readable before confirmation. */
  readonly detailed?: boolean;
  /** 무엇을 하는지 한 줄로. 내부 처리를 그대로 적지 않는다. */
  readonly title: string;
  readonly before: readonly DraftRow[];
  readonly after: readonly DraftRow[];
  /**
   * 이동 거리가 얼마나 줄어드는지(km). 양수면 줄어든다.
   * 좌표가 없는 장소가 섞이면 계산할 수 없으므로 null이다.
   */
  readonly distanceDeltaKm: number | null;
  /** 실제로 반영할 수 있는 변경인지. 거짓이면 버튼을 잠근다. */
  readonly applicable: boolean;
}

function row(stop: TripStop, flags: Partial<DraftRow> = {}): DraftRow {
  return { id: stop.id, name: stop.name, added: false, removed: false, ...flags };
}

function stopsOn(trip: Trip, date: IsoDate | null): TripStop[] {
  return trip.stops.filter((s) => s.date === date && !s.excluded).sort((a, b) => a.order - b.order);
}

/** 이어지는 좌표를 모두 더한 직선 거리. 하나라도 좌표가 없으면 null이다. */
function routeKm(stops: readonly TripStop[]): number | null {
  const points = stops.map((s) => s.location);
  if (points.some((p) => p === null)) return null;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineKm(points[i - 1]!, points[i]!);
  return total;
}

/** 일차 번호를 사람이 읽는 말로. 날짜가 없는 여행이면 '미배치'다. */
function dayLabel(trip: Trip, date: IsoDate | null): string {
  if (!date) return '미배치';
  if (!trip.startDate) return date;
  return `${diffDays(trip.startDate, date) + 1}일차`;
}

/**
 * 하루 안에서 가장 가까운 곳부터 잇는 차례. 첫 장소는 출발점이라 그대로 둔다.
 *
 * 좌표가 없는 장소가 섞이면 거리로 고를 수 없으므로 원래 차례를 그대로
 * 돌려준다. 좌표 없는 항목을 뒤로 밀면 사용자가 정한 순서가 뜻 없이 바뀐다.
 */
export function nearestOrder(
  stops: readonly { readonly id: string; readonly location: GeoPoint | null }[],
): string[] {
  if (stops.length === 0) return [];
  if (stops.some((s) => s.location === null)) return stops.map((s) => s.id);
  const remaining = [...stops];
  const ordered = [remaining.shift()!];
  while (remaining.length) {
    const from = ordered[ordered.length - 1]!.location!;
    let best = 0;
    let bestKm = haversineKm(from, remaining[0]!.location!);
    for (let i = 1; i < remaining.length; i += 1) {
      const km = haversineKm(from, remaining[i]!.location!);
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    }
    ordered.push(remaining.splice(best, 1)[0]!);
  }
  return ordered.map((s) => s.id);
}

export function previewDraft(trip: Trip, draft: ChatDraft): DraftPreview {
  switch (draft.action) {
    case 'local-change': {
      const tripChanged = draft.before.title !== draft.after.title
        || draft.before.startDate !== draft.after.startDate || draft.before.endDate !== draft.after.endDate;
      const describe = (value: Trip) => [
        ...(tripChanged ? [{ id: 'trip', name: `${value.title} · ${value.startDate ?? '날짜 미정'} ~ ${value.endDate ?? '미정'}`, added: false, removed: false }] : []),
        ...value.stops.filter(s => JSON.stringify(draft.before.stops.find(b => b.id === s.id)) !== JSON.stringify(draft.after.stops.find(b => b.id === s.id))).map(s => row(s, { name: describeStop(s) })),
        ...value.stays.filter(s => JSON.stringify(draft.before.stays.find(b => b.id === s.id)) !== JSON.stringify(draft.after.stays.find(b => b.id === s.id))).map(s => ({id: s.id, name: `${s.name} · ${s.checkIn} ~ ${s.checkOut}`, added: false, removed: false})),
      ];
      const ledgerRows = (value: NonNullable<typeof draft.ledger>['before']) => [
        ...(draft.ledger?.before.budget !== draft.ledger?.after.budget ? [{ id: 'budget', name: `예산 ${value.budget === null ? '미정' : value.budget.toLocaleString() + '원'}`, added: false, removed: false }] : []),
        ...value.expenses.filter(e => JSON.stringify(draft.ledger?.before.expenses.find(b => b.id === e.id)) !== JSON.stringify(draft.ledger?.after.expenses.find(b => b.id === e.id))).map(e => ({ id: e.id, name: `${e.date} · ${e.title} · ${e.amount.toLocaleString()}원`, added: false, removed: false })),
      ];
      return { title: draft.title, detailed: true, before: draft.ledger ? ledgerRows(draft.ledger.before) : describe(draft.before),
        after: draft.ledger ? ledgerRows(draft.ledger.after) : describe(draft.after), distanceDeltaKm: null,
        applicable: localChangeValid(trip, draft) };
    }
    case 'assign-unassigned': {
      const targets = draft.stopIds.map(id => trip.stops.find(s => s.id === id));
      const before = stopsOn(trip, draft.date);
      return {
        title: `미배치 ${draft.stopIds.length}곳 → ${dayLabel(trip, draft.date)} (${draft.date})`,
        before: before.map(s => row(s)),
        after: [...before.map(s => row(s)), ...targets.filter((s): s is TripStop => !!s).map(s => row(s, { added: true }))],
        distanceDeltaKm: null,
        applicable: !!trip.startDate && !!trip.endDate && isIsoDate(draft.date)
          && draft.date >= trip.startDate && draft.date <= trip.endDate
          && targets.length > 0 && new Set(draft.stopIds).size === targets.length
          && targets.every(s => !!s && s.date === null && !s.excluded),
      };
    }
    case 'move':
      return previewMove(trip, draft.date, draft.orderedStopIds);
    case 'append':
      return previewAppend(trip, draft.places);
    case 'remove':
      return previewRemove(trip, draft.stopIds);
    case 'reschedule':
      return previewReschedule(trip, draft.stopId, draft.date);
  }
}

function previewMove(
  trip: Trip,
  date: IsoDate | null,
  orderedStopIds: readonly string[],
): DraftPreview {
  const before = stopsOn(trip, date);
  const byId = new Map(before.map((s) => [s.id, s] as const));
  const after = orderedStopIds.map((id) => byId.get(id)).filter((s): s is TripStop => !!s);
  // 그날에 있는 장소를 모두 담지 않은 순서는 반영하면 빠지는 장소가 생긴다.
  const complete = after.length === before.length && before.length > 0;
  const beforeKm = routeKm(before);
  const afterKm = routeKm(after);
  const delta = beforeKm !== null && afterKm !== null ? beforeKm - afterKm : null;
  return {
    title: `${dayLabel(trip, date)} 순서를 바꿉니다`,
    before: before.map((s) => row(s)),
    after: after.map((s) => row(s)),
    distanceDeltaKm: delta,
    // 순서가 그대로면 바꿀 것이 없다.
    applicable: complete && before.some((s, i) => s.id !== after[i]!.id),
  };
}

function previewAppend(
  trip: Trip,
  places: readonly { id: string; name: string; verified: boolean; day: number }[],
): DraftPreview {
  // 확인되지 않은 이름은 좌표가 없어 지도에 올릴 수 없으므로 담지 않는다.
  const usable = places.filter((p) => p.verified);
  const target = places[0] ? dayOf(trip, places[0].day) : null;
  const before = stopsOn(trip, target);
  return {
    title: usable.length === 1 ? '장소를 하나 더합니다' : `장소 ${usable.length}곳을 더합니다`,
    before: before.map((s) => row(s)),
    after: [
      ...before.map((s) => row(s)),
      ...usable.map((p) => ({ id: p.id, name: p.name, added: true, removed: false })),
    ],
    // 더하는 일은 기존 순서를 건드리지 않으므로 거리 비교가 뜻을 갖지 않는다.
    distanceDeltaKm: null,
    applicable: usable.length > 0,
  };
}

function previewRemove(trip: Trip, stopIds: readonly string[]): DraftPreview {
  const ids = new Set(stopIds);
  const targets = trip.stops.filter((s) => ids.has(s.id));
  const date = targets[0]?.date ?? null;
  const before = stopsOn(trip, date);
  const after = before.filter((s) => !ids.has(s.id));
  const beforeKm = routeKm(before);
  const afterKm = routeKm(after);
  return {
    title: targets.length === 1 ? '장소를 하나 뺍니다' : `장소 ${targets.length}곳을 뺍니다`,
    before: before.map((s) => row(s, { removed: ids.has(s.id) })),
    after: after.map((s) => row(s)),
    distanceDeltaKm: beforeKm !== null && afterKm !== null ? beforeKm - afterKm : null,
    applicable: targets.length > 0,
  };
}

function previewReschedule(trip: Trip, stopId: string, date: IsoDate | null): DraftPreview {
  const target = trip.stops.find((s) => s.id === stopId);
  if (!target)
    return {
      title: '옮길 장소를 찾지 못했습니다',
      before: [],
      after: [],
      distanceDeltaKm: null,
      applicable: false,
    };
  const before = stopsOn(trip, date);
  return {
    title: `${target.name}을(를) ${dayLabel(trip, date)}로 옮깁니다`,
    before: before.map((s) => row(s)),
    after: [...before.map((s) => row(s)), row(target, { added: true })],
    distanceDeltaKm: null,
    applicable: target.date !== date,
  };
}

/** 일차 번호를 실제 날짜로. 기간 밖이거나 날짜를 정하지 않았으면 미배치다. */
function dayOf(trip: Trip, day: number): IsoDate | null {
  if (!trip.startDate || !trip.endDate) return null;
  const last = diffDays(trip.startDate, trip.endDate) + 1;
  if (day < 1 || day > last) return null;
  return addDays(trip.startDate, day - 1);
}

/**
 * 확인한 변경을 실제 일정에 반영한다. 되돌리기는 이 함수를 부르기 전의 여행을
 * 그대로 보관했다가 되돌려 놓는 방식이라 여기서 다루지 않는다.
 */
export function applyDraft(trip: Trip, draft: ChatDraft): Trip {
  switch (draft.action) {
    case 'local-change':
      return localChangeValid(trip, draft) ? { ...draft.after, updatedAt: trip.updatedAt } : trip;
    case 'assign-unassigned':
      return previewDraft(trip, draft).applicable
        ? draft.stopIds.reduce((next, id) => placeStopOnDate(next, id, draft.date), trip)
        : trip;
    case 'append':
      return applyAppend(trip, draft.places);
    case 'remove':
      return draft.stopIds.reduce((acc, id) => removeStop(acc, id), trip);
    case 'move':
      return applyMove(trip, draft.date, draft.orderedStopIds);
    case 'reschedule':
      return placeStopOnDate(trip, draft.stopId, draft.date);
  }
}

function applyAppend(
  trip: Trip,
  places: readonly {
    id: string;
    day: number;
    name: string;
    kind: TripStop['kind'];
    verified: boolean;
    address: string;
    location: TripStop['location'];
    placeRef: TripStop['placeRef'];
  }[],
): Trip {
  let next = trip;
  for (const place of places) {
    if (!place.verified) continue;
    next = appendStop(
      next,
      createStop({
        name: place.name,
        kind: place.kind,
        address: place.address,
        // 지역은 검색으로 얻은 주소에서 찾는다. 사용자가 고를 필요가 없다.
        regionId: regionIdForAddress(place.address, next.regions),
        date: dayOf(next, place.day),
        location: place.location,
        placeRef: place.placeRef,
      }),
    );
  }
  return next;
}

/**
 * 하루의 차례를 통째로 다시 매긴다. `moveStop`은 한 칸씩 옮기는 함수라
 * 여러 칸을 옮기려면 여러 번 불러야 하고 중간 상태가 화면에 비칠 수 있다.
 */
function applyMove(trip: Trip, date: IsoDate | null, orderedStopIds: readonly string[]): Trip {
  const rank = new Map(orderedStopIds.map((id, i) => [id, i] as const));
  const stops = trip.stops.map((s) => {
    if (s.date !== date) return s;
    const order = rank.get(s.id);
    return order === undefined ? s : { ...s, order };
  });
  return { ...trip, stops };
}
