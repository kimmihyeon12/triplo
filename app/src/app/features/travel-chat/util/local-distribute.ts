import { addDays, diffDays, enumerateDays } from '../../../shared/util/dates';
import type { Trip, TripStop } from '../../trips/model/trip';
import { haversineKm } from '../../trips/util/itinerary';
import type { ChatReply } from '../model/chat';

/**
 * 저장된(날짜 없는) 장소를 여러 날에 나눠 담는다(2026-10-01 사용자 지적).
 * "일차에 해당 여행 모두 담아", "10월 2일부터 4일까지 코스 구성"처럼 말하면 모델이
 * 말로만 답하고 실제로 배치하지 못했다. 저장된 좌표로 앱이 직접 나눈다.
 */

/** 여러 날에 나누라는 말. 한 날짜로 모두 옮기는 명령(local-assignment)과 구분한다. */
const SPREAD = /나눠|나누어|일차별|날짜별|하루씩|일차에|코스\s*(로|를)?\s*(짜|구성)|일정\s*(으로|에)\s*(담|배치|나눠)/;
const ALL = /모두|전부|전체|저장된|해당\s*여행|장소들/;
const RANGE_DAYS = /(\d+)\s*일\s*차\s*부터\s*(\d+)\s*일\s*차/;
const RANGE_DATES = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*부터\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일/;

const reply = (text: string): ChatReply => ({
  kind: 'explore', text, reference: null, places: [], regions: [], edit: null, chips: [],
});

/** 말에서 나눌 날짜들을 읽는다. 범위가 없으면 여행 전체 기간이다. 기간 밖이면 null. */
function datesFor(text: string, trip: Trip): string[] | null {
  const start = trip.startDate!;
  const end = trip.endDate!;
  const all = enumerateDays(start, end);
  const days = RANGE_DAYS.exec(text);
  if (days) {
    const from = Number(days[1]);
    const to = Number(days[2]);
    if (from < 1 || to < from || to > all.length) return null;
    return all.slice(from - 1, to);
  }
  const dates = RANGE_DATES.exec(text);
  if (dates) {
    const year = start.slice(0, 4);
    const pad = (n: string) => n.padStart(2, '0');
    const from = `${year}-${pad(dates[1]!)}-${pad(dates[2]!)}`;
    const to = `${year}-${pad(dates[3] ?? dates[1]!)}-${pad(dates[4]!)}`;
    if (from < start || to > end || to < from) return null;
    return enumerateDays(from, to);
  }
  return all;
}

/**
 * 가까운 곳끼리 같은 날에 오도록 나눈다. 가장 서쪽에서 출발해 가장 가까운 곳을 차례로
 * 이은 뒤, 그 줄을 날 수만큼 비슷한 길이로 자른다. 좌표가 없는 곳은 적게 담긴 날부터 채운다.
 */
export function distributeStops(stops: readonly TripStop[], dates: readonly string[]): { stopId: string; date: string }[] {
  const located = stops.filter((s) => s.location);
  const chain: TripStop[] = [];
  const left = [...located].sort((a, b) => a.location!.lng - b.location!.lng);
  let current = left.shift();
  while (current) {
    chain.push(current);
    let best = -1;
    let bestKm = Infinity;
    left.forEach((s, i) => {
      const km = haversineKm(current!.location!, s.location!);
      if (km < bestKm) [best, bestKm] = [i, km];
    });
    current = best >= 0 ? left.splice(best, 1)[0] : undefined;
  }
  const out: { stopId: string; date: string }[] = [];
  const counts = dates.map(() => 0);
  let index = 0;
  dates.forEach((date, d) => {
    // 앞날에 하나씩 더 담아 날마다 차이가 1을 넘지 않게 한다.
    const size = Math.floor(chain.length / dates.length) + (d < chain.length % dates.length ? 1 : 0);
    for (const s of chain.slice(index, index + size)) out.push({ stopId: s.id, date });
    counts[d] = size;
    index += size;
  });
  for (const s of stops.filter((x) => !x.location)) {
    const d = counts.indexOf(Math.min(...counts));
    out.push({ stopId: s.id, date: dates[d]! });
    counts[d]!++;
  }
  return out;
}

export function distributeAnswer(text: string, trip: Trip | null): ChatReply | null {
  const ranged = RANGE_DAYS.test(text) || RANGE_DATES.test(text);
  if (!SPREAD.test(text) || !(ALL.test(text) || ranged)) return null;
  if (!trip) return null;
  if (!trip.startDate || !trip.endDate) return reply('먼저 여행 날짜를 정해 주세요. 날짜가 있어야 일차별로 나눌 수 있어요.');
  const dates = datesFor(text, trip);
  if (!dates) return reply(`여행 기간(${trip.startDate} ~ ${trip.endDate}) 안의 날짜로 알려 주세요.`);
  const targets = trip.stops.filter((s) => !s.excluded && s.date === null).sort((a, b) => a.order - b.order);
  if (!targets.length) return reply('날짜가 정해지지 않은 장소가 없어요. 순서를 정리하려면 "순서 정리해줘"라고 말해 주세요.');
  const first = diffDays(trip.startDate, dates[0]!) + 1;
  const range = dates.length === 1 ? `${first}일차` : `${first}~${first + dates.length - 1}일차`;
  return {
    ...reply(`저장된 장소 ${targets.length}곳을 가까운 곳끼리 묶어 ${range}(${dates[0]} ~ ${addDays(dates[0]!, dates.length - 1)})에 나눠 담을게요. 확인 후 적용해 주세요.`),
    kind: 'draft',
    edit: { action: 'distribute', assignments: distributeStops(targets, dates) },
  };
}
