import type { Ledger } from '../../expenses/model/ledger';
import { formatWon } from '../../../shared/util/won';
import { addDays, diffDays, isIsoDate } from '../../../shared/util/dates';
import { findRegionByCode } from '../../../shared/util/korea-regions';
import { regionCodeForAddress } from '../../stats/util/province-match';
import { createRegion, createStop } from '../../trips/util/factories';
import { appendStop, haversineKm, placeStopOnDate, removeStop } from '../../trips/util/itinerary';
import { regionIdForAddress } from '../../trips/util/region-match';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip, TripRegion, TripStop } from '../../trips/model/trip';
import type { AppendDraft, ChatDraft } from '../model/chat';
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
  /** 더하는 장소의 추천 이유 한 줄(AI 설명). */
  readonly why?: string;
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
      const { ledger } = draft;
      if (ledger) {
        const changes = ledgerChanges(ledger.before, ledger.after);
        return { title: draft.title, detailed: true, before: ledgerPreviewRows(ledger.before, changes),
          after: ledgerPreviewRows(ledger.after, changes), distanceDeltaKm: null,
          applicable: localChangeValid(trip, draft) };
      }
      const changes = tripChanges(draft.before, draft.after);
      return { title: draft.title, detailed: true, before: tripPreviewRows(draft.before, changes),
        after: tripPreviewRows(draft.after, changes), distanceDeltaKm: null,
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
    case 'distribute': {
      const byId = new Map(trip.stops.map((s) => [s.id, s] as const));
      const targets = draft.assignments.map((a) => ({ a, stop: byId.get(a.stopId) }));
      const sorted = [...targets].sort((x, y) => x.a.date.localeCompare(y.a.date));
      const days = new Set(draft.assignments.map((a) => a.date));
      return {
        title: `저장된 장소 ${draft.assignments.length}곳을 ${days.size}일에 나눠 담습니다`,
        detailed: true,
        before: targets.filter((t) => t.stop).map((t) => row(t.stop!)),
        after: sorted
          .filter((t) => t.stop)
          .map((t) => ({ id: t.a.stopId, name: `${dayLabel(trip, t.a.date)} · ${t.stop!.name}`, added: true, removed: false })),
        distanceDeltaKm: null,
        applicable: !!trip.startDate && !!trip.endDate && draft.assignments.length > 0
          && new Set(draft.assignments.map((a) => a.stopId)).size === draft.assignments.length
          && targets.every((t) => !!t.stop && t.stop.date === null && !t.stop.excluded
            && isIsoDate(t.a.date) && t.a.date >= trip.startDate! && t.a.date <= trip.endDate!),
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

/**
 * 두 목록에서 내용이 달라진 항목의 id. 한쪽에만 있는 항목(추가·삭제)도 들어간다.
 * 비교 기준은 전과 같이 JSON 표현이고, 같은 id가 여럿이면 첫 항목을 본다.
 * 항목마다 상대 목록을 다시 훑던 방식을 id별 Map 한 번으로 바꿨다(리팩터링 제안 C2).
 */
function changedIds<T extends { readonly id: string }>(before: readonly T[], after: readonly T[]): ReadonlySet<string> {
  const index = (items: readonly T[]) => {
    const map = new Map<string, string>();
    for (const item of items) if (!map.has(item.id)) map.set(item.id, JSON.stringify(item));
    return map;
  };
  const prev = index(before);
  const next = index(after);
  const changed = new Set<string>();
  for (const id of new Set([...prev.keys(), ...next.keys()])) if (prev.get(id) !== next.get(id)) changed.add(id);
  return changed;
}

interface TripChanges {
  readonly tripInfo: boolean;
  readonly stops: ReadonlySet<string>;
  readonly stays: ReadonlySet<string>;
}

function tripChanges(before: Trip, after: Trip): TripChanges {
  return {
    tripInfo: before.title !== after.title || before.startDate !== after.startDate || before.endDate !== after.endDate,
    stops: changedIds(before.stops, after.stops),
    stays: changedIds(before.stays, after.stays),
  };
}

/** 확인 카드의 한쪽(전 또는 후) 여행에서 바뀐 것만 원래 순서대로 행으로 만든다(리팩터링 제안 C1). */
function tripPreviewRows(value: Trip, changes: TripChanges): DraftRow[] {
  return [
    ...(changes.tripInfo ? [{ id: 'trip', name: `${value.title} · ${value.startDate ?? '날짜 미정'} ~ ${value.endDate ?? '미정'}`, added: false, removed: false }] : []),
    ...value.stops.filter(s => changes.stops.has(s.id)).map(s => row(s, { name: describeStop(s) })),
    ...value.stays.filter(s => changes.stays.has(s.id)).map(s => ({ id: s.id, name: `${s.name} · ${s.checkIn} ~ ${s.checkOut}`, added: false, removed: false })),
  ];
}

interface LedgerChanges {
  readonly budget: boolean;
  readonly expenses: ReadonlySet<string>;
}

function ledgerChanges(before: Ledger, after: Ledger): LedgerChanges {
  return { budget: before.budget !== after.budget, expenses: changedIds(before.expenses, after.expenses) };
}

/** 확인 카드의 한쪽 가계부에서 바뀐 예산과 지출만 행으로 만든다(리팩터링 제안 C1). */
function ledgerPreviewRows(value: Ledger, changes: LedgerChanges): DraftRow[] {
  return [
    ...(changes.budget ? [{ id: 'budget', name: `예산 ${value.budget === null ? '미정' : formatWon(value.budget)}`, added: false, removed: false }] : []),
    ...value.expenses.filter(e => changes.expenses.has(e.id)).map(e => ({ id: e.id, name: `${e.date} · ${e.title} · ${formatWon(e.amount)}`, added: false, removed: false })),
  ];
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
  places: readonly { id: string; name: string; verified: boolean; day: number; why?: string }[],
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
      ...usable.map((p) => ({ id: p.id, name: p.name, added: true, removed: false, ...(p.why ? { why: p.why } : {}) })),
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
    case 'distribute':
      return previewDraft(trip, draft).applicable
        ? draft.assignments.reduce((next, a) => placeStopOnDate(next, a.stopId, a.date), trip)
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
    why?: string;
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
        // 추천 이유는 일정 짜기의 'AI 추정' 메모처럼 머리줄 아래 '-' 목록으로 남긴다.
        ...(place.why ? { memo: `AI 추천\n- ${place.why}` } : {}),
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

/**
 * 대화로 새 여행을 세울 때의 지역. 장소 검색으로 확인한 주소에서 시·군·구를 읽는다.
 *
 * 모델이 쓴 지역 이름('서울')은 쓰지 않는다. 저장하는 분류는 검증된 출처에서만
 * 가져오고(AGENTS.md), 일반 여행 만들기도 시·군·구만 고르게 한다. 시·도 이름으로
 * 만들면 어느 자치구인지 알 수 없어 통계와 편집 화면이 어긋난다.
 * 읽지 못하면 지역 없이 둔다. 추측하지 않는다.
 */
export function draftTripRegions(draft: AppendDraft): TripRegion[] {
  const regions: TripRegion[] = [];
  for (const place of draft.places) {
    if (!place.verified) continue;
    const code = regionCodeForAddress(place.address);
    const found = code ? findRegionByCode(code) : null;
    if (!found || regions.some((r) => r.regionCode === found.code)) continue;
    // 이름이 겹치는 자치구('중구')가 있어 이름으로 다시 찾지 않고 읽은 코드를 그대로 둔다.
    regions.push({ ...createRegion(found.name, regions.length), regionCode: found.code });
  }
  return regions;
}
