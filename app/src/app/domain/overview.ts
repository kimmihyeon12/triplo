import { enumerateDays } from './dates';
import { dayRegionNames, daySegments, dayStops, dayTotals, fixedTimeConflicts, unassignedStops, type DayTotals } from './itinerary';
import type { IsoDate, Trip, TripStop } from './model';
import { dayStayInfo, nightCoverage, stayIssues, type NightState } from './stays';

export interface OverviewDay {
  dayNumber: number;
  date: IsoDate;
  regionNames: string[];
  stopNames: string[];
  totals: DayTotals;
  regionChangeCount: number;
  nightLabel: string;
  nightState: NightState | 'none';
  fixedTimeConflictCount: number;
}

export type IssueKind = 'stay-conflict' | 'stay-out-of-range' | 'night-undecided' | 'fixed-time' | 'unverified-location';

export interface OverviewIssue {
  kind: IssueKind;
  label: string;
  count: number;
  /** 해당 탭으로 안내 */
  tab: 'days' | 'stays';
}

export interface TripOverview {
  undecidedDates: boolean;
  days: OverviewDay[];
  unassigned: TripStop[];
  issues: OverviewIssue[];
}

function nightLabel(trip: Trip, date: IsoDate): { label: string; state: NightState | 'none' } {
  const info = dayStayInfo(trip, date);
  if (info.lastDay) return { label: '귀가일', state: 'none' };
  if (info.tonight.length === 0) {
    return info.checkOuts.length > 0
      ? { label: `${info.checkOuts.map((s) => s.name).join(', ')} 체크아웃 · 숙소 미정`, state: 'undecided' }
      : { label: '숙소 미정', state: 'undecided' };
  }
  if (info.tonight.length > 1) return { label: `${info.tonight.map((s) => s.name).join(' / ')} 중복`, state: 'conflict' };
  const stay = info.tonight[0];
  if (info.consecutive) return { label: `${stay.name} 연박`, state: 'covered' };
  if (info.checkOuts.length > 0) return { label: `${info.checkOuts.map((s) => s.name).join(', ')} 체크아웃 → ${stay.name} 체크인`, state: 'covered' };
  return { label: `${stay.name} 체크인`, state: 'covered' };
}

export function buildOverview(trip: Trip): TripOverview {
  const undecidedDates = !trip.startDate || !trip.endDate;
  const days: OverviewDay[] = undecidedDates
    ? []
    : enumerateDays(trip.startDate!, trip.endDate!).map((date, i) => {
        const night = nightLabel(trip, date);
        return {
          dayNumber: i + 1,
          date,
          regionNames: dayRegionNames(trip, date),
          stopNames: dayStops(trip, date).filter((s) => !s.excluded).map((s) => s.name),
          totals: dayTotals(trip, date),
          regionChangeCount: daySegments(trip, date).filter((s) => s.type === 'leg' && s.regionChange).length,
          nightLabel: night.label,
          nightState: night.state,
          fixedTimeConflictCount: fixedTimeConflicts(trip, date).length,
        };
      });

  const issues: OverviewIssue[] = [];
  const coverage = nightCoverage(trip);
  const conflictNights = coverage.filter((n) => n.state === 'conflict').length;
  if (conflictNights > 0) issues.push({ kind: 'stay-conflict', label: '숙박 날짜 중복', count: conflictNights, tab: 'stays' });
  const outOfRange = [...stayIssues(trip).values()].filter((v) => v.includes('여행 기간 밖')).length;
  if (outOfRange > 0) issues.push({ kind: 'stay-out-of-range', label: '여행 기간 밖 숙박', count: outOfRange, tab: 'stays' });
  const undecidedNights = coverage.filter((n) => n.state === 'undecided').length;
  if (undecidedNights > 0) issues.push({ kind: 'night-undecided', label: '숙소 미정인 밤', count: undecidedNights, tab: 'stays' });
  const fixedConflicts = days.reduce((sum, d) => sum + d.fixedTimeConflictCount, 0);
  if (fixedConflicts > 0) issues.push({ kind: 'fixed-time', label: '고정 시각 순서 충돌', count: fixedConflicts, tab: 'days' });
  const unverified = trip.stops.filter((s) => s.locationStatus === 'unverified').length + trip.stays.filter((s) => s.locationStatus === 'unverified').length;
  if (unverified > 0) issues.push({ kind: 'unverified-location', label: '위치 미확인 항목', count: unverified, tab: 'days' });

  return { undecidedDates, days, unassigned: unassignedStops(trip), issues };
}
