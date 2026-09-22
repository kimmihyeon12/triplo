import { addDays, diffDays, isIsoDate } from '../../../shared/util/dates';
import type { Trip, TripStop } from '../../trips/model/trip';

export function commandDate(text: string, trip: Trip, today: string): string | null {
  const dates = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(m => m[0]);
  const days = [...text.matchAll(/(\d+)\s*일차/g)].map(m => Number(m[1]));
  if (/첫날|첫째\s*날/.test(text)) days.push(1);
  if (days.length && !trip.startDate) return null;
  dates.push(...days.map(day => addDays(trip.startDate!, day - 1)));
  if (/오늘/.test(text)) dates.push(today);
  if (/내일/.test(text)) dates.push(addDays(today, 1));
  if (new Set(dates).size !== 1) return null;
  const date = dates[0];
  return isIsoDate(date) && !!trip.startDate && !!trip.endDate && date >= trip.startDate && date <= trip.endDate ? date : null;
}

export function dateLabel(trip: Trip, date: string | null): string {
  return date && trip.startDate ? `${diffDays(trip.startDate, date) + 1}일차 (${date})` : date ?? '미배치';
}

export function commandTargets(text: string, trip: Trip, today: string, includeExcluded = false): TripStop[] | string {
  const named = trip.stops.filter(s => s.name && text.includes(s.name));
  if (named.length) {
    if (named.some(s => named.filter(other => other.name === s.name).length > 1)) return '같은 이름의 장소가 여러 곳이에요. 일정 화면에서 대상을 선택해 주세요.';
    // Overlapping names must not accidentally select the shorter name as well.
    if (named.some(s => named.some(other => s.id !== other.id && other.name.includes(s.name)))) return '장소 이름이 겹쳐요. 일정 화면에서 대상을 선택해 주세요.';
  }
  if (/이 장소|그 장소|여기|거기/.test(text)) return '어느 장소인지 저장된 이름으로 알려 주세요.';
  let scope = text;
  for (const stop of named) scope = scope.split(stop.name).join('');
  let targets = (named.length ? named : trip.stops).filter(s => includeExcluded || !s.excluded);
  if (/미배치/.test(scope)) targets = targets.filter(s => s.date === null);
  else if (/\d+\s*일차|오늘|내일|\d{4}-\d{2}-\d{2}/.test(scope)) {
    const date = commandDate(scope, trip, today);
    if (!date) return '여행 기간 안의 날짜를 하나만 지정해 주세요.';
    targets = targets.filter(s => s.date === date);
  }
  if (/카페/.test(scope)) targets = targets.filter(s => s.kind === 'break');
  else if (/식사|식당/.test(scope)) targets = targets.filter(s => s.kind === 'meal');
  else if (/여유시간/.test(scope)) targets = targets.filter(s => s.kind === 'buffer');
  else if (!named.length && !/미배치|일차|오늘|내일|전체|전부|모두|\d{4}-\d{2}-\d{2}/.test(scope)) return '변경할 장소 이름이나 전체 대상을 알려 주세요.';
  return targets;
}
