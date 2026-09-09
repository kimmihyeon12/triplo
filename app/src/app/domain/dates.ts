import type { IsoDate } from './model';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): IsoDate {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_MS = 86_400_000;

/** b - a 일수. 같은 날이면 0. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** 시작~종료의 밤 수. 당일은 0. */
export function nightsBetween(start: IsoDate, end: IsoDate): number {
  return Math.max(0, diffDays(start, end));
}

/** 시작·종료를 포함한 날짜 목록. 종료가 앞서면 빈 배열. */
export function enumerateDays(start: IsoDate, end: IsoDate): IsoDate[] {
  const n = diffDays(start, end);
  if (n < 0) return [];
  const out: IsoDate[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

/** 여행의 밤 목록: [start, end). 당일이면 빈 배열. */
export function tripNights(start: IsoDate, end: IsoDate): IsoDate[] {
  const days = enumerateDays(start, end);
  return days.slice(0, -1);
}

export type TripDateValidation =
  | { ok: true; undecided: boolean }
  | { ok: false; message: string };

export function validateTripDates(start: string | null | undefined, end: string | null | undefined): TripDateValidation {
  const s = start?.trim() || null;
  const e = end?.trim() || null;
  if (!s && !e) return { ok: true, undecided: true };
  if (!s || !e) return { ok: false, message: '두 날짜를 모두 입력하거나 모두 비워 두세요.' };
  if (!isIsoDate(s) || !isIsoDate(e)) return { ok: false, message: '날짜 형식이 올바르지 않습니다.' };
  if (diffDays(s, e) < 0) return { ok: false, message: '종료일은 시작일과 같거나 이후여야 합니다.' };
  return { ok: true, undecided: false };
}

export function weekdayOf(date: IsoDate): string {
  return WEEKDAYS[new Date(toUtc(date)).getUTCDay()];
}

export function formatKoreanDate(date: IsoDate, opts: { short?: boolean } = {}): string {
  const [, m, d] = date.split('-').map(Number);
  return opts.short ? `${m}/${d}(${weekdayOf(date)})` : `${m}월 ${d}일(${weekdayOf(date)})`;
}

export function formatNights(start: IsoDate, end: IsoDate): string {
  const n = nightsBetween(start, end);
  return `${n}박 ${n + 1}일`;
}

export function formatPeriod(start: IsoDate | null, end: IsoDate | null): string {
  if (!start || !end) return '날짜 미정';
  if (start === end) return `${formatKoreanDate(start)} · ${formatNights(start, end)}`;
  return `${formatKoreanDate(start)} – ${formatKoreanDate(end)} · ${formatNights(start, end)}`;
}

export function todayIso(): IsoDate {
  return fromUtc(Date.now() - new Date().getTimezoneOffset() * 60_000);
}
