import { addDays, diffDays, enumerateDays, isIsoDate, tripNights } from './dates';
import type { AccommodationStay, IsoDate, Trip } from './model';

export type StayDateValidation = { ok: true } | { ok: false; message: string };

export function validateStayDates(checkIn: string, checkOut: string): StayDateValidation {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return { ok: false, message: '체크인·체크아웃 날짜를 입력하세요.' };
  if (diffDays(checkIn, checkOut) < 1) return { ok: false, message: '체크아웃 날짜는 체크인 다음 날 이후여야 합니다.' };
  return { ok: true };
}

/** 숙박 밤 목록: [checkIn, checkOut) */
export function stayNights(stay: Pick<AccommodationStay, 'checkIn' | 'checkOut'>): IsoDate[] {
  return enumerateDays(stay.checkIn, addDays(stay.checkOut, -1));
}

export function stayNightCount(stay: Pick<AccommodationStay, 'checkIn' | 'checkOut'>): number {
  return Math.max(0, diffDays(stay.checkIn, stay.checkOut));
}

export function stayOverlaps(a: Pick<AccommodationStay, 'checkIn' | 'checkOut'>, b: Pick<AccommodationStay, 'checkIn' | 'checkOut'>): boolean {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

export type NightState = 'covered' | 'undecided' | 'conflict';

export interface NightCoverage {
  night: IsoDate;
  nightNumber: number;
  stays: AccommodationStay[];
  state: NightState;
  /** 전날 밤과 같은 숙소(연박) */
  consecutive: boolean;
}

export function nightCoverage(trip: Trip): NightCoverage[] {
  if (!trip.startDate || !trip.endDate) return [];
  const nights = tripNights(trip.startDate, trip.endDate);
  let prevIds = new Set<string>();
  return nights.map((night, i) => {
    const stays = trip.stays.filter((s) => s.checkIn <= night && night < s.checkOut);
    const ids = new Set(stays.map((s) => s.id));
    const consecutive = stays.length === 1 && prevIds.has(stays[0].id);
    prevIds = ids;
    const state: NightState = stays.length === 0 ? 'undecided' : stays.length === 1 ? 'covered' : 'conflict';
    return { night, nightNumber: i + 1, stays, state, consecutive };
  });
}

export interface DayStayInfo {
  date: IsoDate;
  /** 이 날 체크아웃하는 숙박 */
  checkOuts: AccommodationStay[];
  /** 이 날 체크인하는 숙박 */
  checkIns: AccommodationStay[];
  /** 이 날 밤 묵는 숙박 */
  tonight: AccommodationStay[];
  /** 전날 밤과 같은 숙소 */
  consecutive: boolean;
  /** 여행 마지막 날(밤 없음) */
  lastDay: boolean;
  /** 날짜 미정 여행 */
  undecidedTrip: boolean;
}

export function dayStayInfo(trip: Trip, date: IsoDate): DayStayInfo {
  const checkOuts = trip.stays.filter((s) => s.checkOut === date);
  const checkIns = trip.stays.filter((s) => s.checkIn === date);
  const tonight = trip.stays.filter((s) => s.checkIn <= date && date < s.checkOut);
  const yesterday = addDays(date, -1);
  const lastNight = trip.stays.filter((s) => s.checkIn <= yesterday && yesterday < s.checkOut);
  const consecutive = tonight.length === 1 && lastNight.some((s) => s.id === tonight[0].id);
  const lastDay = !!trip.endDate && date === trip.endDate;
  return { date, checkOuts, checkIns, tonight, consecutive, lastDay, undecidedTrip: !trip.startDate || !trip.endDate };
}

export const STAY_ISSUE_OUT_OF_RANGE = '여행 기간 밖';
export const STAY_ISSUE_OVERLAP = '다른 숙박과 중복';

/** 숙박별 확인 필요 사유. 날짜 미정 여행은 기간 검사를 건너뛴다. */
export function stayIssues(trip: Trip): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const nights = trip.startDate && trip.endDate ? new Set(tripNights(trip.startDate, trip.endDate)) : null;
  for (const stay of trip.stays) {
    const issues: string[] = [];
    if (nights && stayNights(stay).some((n) => !nights.has(n))) issues.push(STAY_ISSUE_OUT_OF_RANGE);
    if (trip.stays.some((o) => o.id !== stay.id && stayOverlaps(o, stay))) issues.push(STAY_ISSUE_OVERLAP);
    out.set(stay.id, issues);
  }
  return out;
}

/** '2026-05-02' → '5/2' */
function md(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

/** 폼에서 저장 전 확인용: 입력 중인 숙박이 기존 숙박과 겹치거나 기간 밖인지 */
export function stayWarnings(trip: Trip, candidate: Pick<AccommodationStay, 'id' | 'checkIn' | 'checkOut'>): string[] {
  const warnings: string[] = [];
  if (trip.startDate && trip.endDate) {
    const nights = new Set(tripNights(trip.startDate, trip.endDate));
    if (stayNights(candidate).some((n) => !nights.has(n))) {
      warnings.push(`숙박이 여행 기간(${md(trip.startDate)}–${md(trip.endDate)}) 밖입니다.`);
    }
  }
  for (const other of trip.stays) {
    if (other.id === candidate.id) continue;
    if (stayOverlaps(other, candidate)) {
      const shared = stayNights(other).filter((n) => stayNights(candidate).includes(n));
      const nightsText = shared.map(md).join(', ');
      warnings.push(`${other.name || '다른 숙소'}(${md(other.checkIn)}–${md(other.checkOut)})와 ${nightsText} 밤이 겹칩니다.`);
    }
  }
  return warnings;
}
