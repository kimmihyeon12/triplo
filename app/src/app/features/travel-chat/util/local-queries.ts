import { tripNights } from '../../../shared/util/dates';
import type { Trip } from '../../trips/model/trip';
import { commandDate, commandTargets, dateLabel } from './local-command-targets';
import type { LocalResult } from './local-command-draft';

export function localQuery(text: string, trip: Trip, today: string): LocalResult | null {
  const active = trip.stops.filter(s => !s.excluded);
  const list = (title: string, rows: string[]): LocalResult => ({ text: `${title}\n${rows.length ? rows.join('\n') : '해당 항목이 없어요.'}` });
  if (/숙소|숙박/.test(text) && /안 정|미정|누락|없는/.test(text)) {
    if (!trip.startDate || !trip.endDate) return { text: '먼저 여행 날짜를 정해 주세요.' };
    return list('숙박이 없는 날짜', tripNights(trip.startDate, trip.endDate).filter(date => !trip.stays.some(s => s.checkIn <= date && s.checkOut > date)));
  }
  if (/중복|두 번|같은 장소/.test(text)) {
    const groups = new Map<string, string[]>();
    for (const stop of active) {
      const key = stop.placeRef ? `${stop.placeRef.provider}:${stop.placeRef.id}` : `${stop.name}|${stop.address}`;
      groups.set(key, [...(groups.get(key) ?? []), `${stop.name} · ${dateLabel(trip, stop.date)}`]);
    }
    return list('중복 후보 (같은 장소를 재방문한 경우도 있어요)', [...groups.values()].filter(g => g.length > 1).map(g => g.join(' / ')));
  }
  if (/겹치|겹치는|충돌/.test(text)) {
    const rows: string[] = [];
    const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (!a.date || a.date !== b.date || !a.fixedTime || !b.fixedTime) continue;
      const startA = minute(a.fixedTime), startB = minute(b.fixedTime);
      if (startA === startB || (a.stayMinutes !== null && b.stayMinutes !== null && startA < startB + b.stayMinutes && startB < startA + a.stayMinutes)) rows.push(`${dateLabel(trip, a.date)} · ${a.name} / ${b.name}`);
    }
    return list('저장된 고정 시각·체류시간 기준 충돌 (이동시간과 미정 시간은 계산 제외)', rows);
  }
  if (/몇\s*일차|언제.*넣|어느.*날/.test(text)) {
    const named = trip.stops.filter(s => s.name && text.includes(s.name));
    return list('저장된 배정 날짜', named.map(s => `${s.name}: ${dateLabel(trip, s.date)}${s.excluded ? ' · 제외됨' : ''}`));
  }
  if (!/보여|알려|찾아|합계|몇 개|몇 곳|얼마|내보내|복사/.test(text)) return null;
  if (/추천|갈 만|가볼|영업|날씨|검색/.test(text)) return null;
  const targets = commandTargets(`${text} 전체`, trip, today);
  if (typeof targets === 'string') return { text: targets };
  if (/체류시간/.test(text)) {
    if (/안 정|없는|미정|누락/.test(text)) return list('체류시간 미정', targets.filter(s => s.stayMinutes === null).map(s => s.name));
    return { text: `저장된 체류시간 합계 ${targets.reduce((n, s) => n + (s.stayMinutes ?? 0), 0)}분 · 미정 ${targets.filter(s => s.stayMinutes === null).length}곳. 이동시간은 포함하지 않았어요.` };
  }
  if (/날짜 없는|미배치/.test(text)) return list('미배치 장소', active.filter(s => s.date === null).map(s => s.name));
  if (/주소|좌표|위치/.test(text) && /없는|미정|누락|미확인/.test(text)) return list('위치 미확인', targets.filter(s => !s.location).map(s => s.name));
  if (/예상.*비용|계획.*금액/.test(text)) return { text: `장소 예상 비용 합계 ${targets.reduce((n, s) => n + (s.estimatedCost ?? 0), 0).toLocaleString()}원 · 미정 ${targets.filter(s => s.estimatedCost == null).length}곳. 실제 지출과 별개예요.` };
  if (/일정|장소|카페|식사|식당|몇 개|몇 곳/.test(text)) {
    // A malformed date filter must not silently return all days.
    if (/\d+일차|오늘|내일/.test(text) && !commandDate(text, trip, today)) return { text: '여행 기간 안의 날짜를 알려 주세요.' };
    const result = list(`${trip.title} · 저장된 장소 ${targets.length}곳`, [...targets].sort((a,b) => (a.date ?? 'z').localeCompare(b.date ?? 'z') || a.order - b.order).map(s => `${dateLabel(trip, s.date)} · ${s.name}${s.fixedTime ? ` · ${s.fixedTime}` : ''}${s.stayMinutes !== null ? ` · ${s.stayMinutes}분` : ''}`));
    if (/복사|내보내/.test(text)) result.copyText = result.text;
    return result;
  }
  return null;
}
