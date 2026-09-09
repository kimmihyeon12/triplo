import { describe, expect, it } from 'vitest';
import { createStay, createTrip } from './model';
import {
  dayStayInfo,
  nightCoverage,
  stayIssues,
  stayNights,
  stayOverlaps,
  validateStayDates,
} from './stays';

const A = createStay({ id: 'A', name: 'A 숙소', checkIn: '2026-05-01', checkOut: '2026-05-03' });
const B = createStay({ id: 'B', name: 'B 숙소', checkIn: '2026-05-03', checkOut: '2026-05-04' });
const C = createStay({ id: 'C', name: 'C 숙소', checkIn: '2026-05-02', checkOut: '2026-05-04' });

describe('stays', () => {
  it('validateStayDates: 체크아웃은 체크인 다음 날 이후여야 한다', () => {
    expect(validateStayDates('2026-05-01', '2026-05-02').ok).toBe(true);
    expect(validateStayDates('2026-05-01', '2026-05-01').ok).toBe(false);
    expect(validateStayDates('2026-05-03', '2026-05-01').ok).toBe(false);
    expect(validateStayDates('', '2026-05-01').ok).toBe(false);
  });

  it('stayNights는 체크인 포함·체크아웃 제외 밤 목록', () => {
    expect(stayNights(A)).toEqual(['2026-05-01', '2026-05-02']);
    expect(stayNights(B)).toEqual(['2026-05-03']);
  });

  it('stayOverlaps: 같은 밤을 공유하면 중복, 체크아웃 날 체크인은 중복 아님', () => {
    expect(stayOverlaps(A, B)).toBe(false);
    expect(stayOverlaps(A, C)).toBe(true);
    expect(stayOverlaps(B, C)).toBe(true);
  });

  it('nightCoverage: 여행의 각 밤에 숙소를 배정하고 미정·충돌을 구분한다', () => {
    const trip = createTrip({ startDate: '2026-05-01', endDate: '2026-05-04', stays: [A, B] });
    const cov = nightCoverage(trip);
    expect(cov.map((n) => n.night)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
    expect(cov[0]).toMatchObject({ stays: [A], state: 'covered', consecutive: false });
    expect(cov[1]).toMatchObject({ stays: [A], state: 'covered', consecutive: true });
    expect(cov[2]).toMatchObject({ stays: [B], state: 'covered', consecutive: false });
  });

  it('nightCoverage: 숙소가 없는 밤은 미정, 둘 이상이면 충돌', () => {
    const trip = createTrip({ startDate: '2026-05-01', endDate: '2026-05-04', stays: [A, C] });
    const cov = nightCoverage(trip);
    expect(cov[0].state).toBe('covered');
    expect(cov[1].state).toBe('conflict');
    expect(cov[2].state).toBe('covered');
    const empty = nightCoverage(createTrip({ startDate: '2026-05-01', endDate: '2026-05-02' }));
    expect(empty[0].state).toBe('undecided');
  });

  it('nightCoverage: 당일 여행이나 날짜 미정 여행은 밤이 없다', () => {
    expect(nightCoverage(createTrip({ startDate: '2026-05-01', endDate: '2026-05-01' }))).toEqual([]);
    expect(nightCoverage(createTrip({ stays: [A] }))).toEqual([]);
  });

  it('dayStayInfo: 그날의 체크아웃·체크인·연박을 구분한다', () => {
    const trip = createTrip({ startDate: '2026-05-01', endDate: '2026-05-04', stays: [A, B] });
    expect(dayStayInfo(trip, '2026-05-01')).toMatchObject({ checkOuts: [], checkIns: [A], tonight: [A], consecutive: false });
    expect(dayStayInfo(trip, '2026-05-02')).toMatchObject({ checkOuts: [], checkIns: [], tonight: [A], consecutive: true });
    expect(dayStayInfo(trip, '2026-05-03')).toMatchObject({ checkOuts: [A], checkIns: [B], tonight: [B], consecutive: false });
    expect(dayStayInfo(trip, '2026-05-04')).toMatchObject({ checkOuts: [B], checkIns: [], tonight: [], lastDay: true });
  });

  it('stayIssues: 기간 밖·중복을 숙박별로 표시한다', () => {
    const trip = createTrip({ startDate: '2026-05-01', endDate: '2026-05-03', stays: [A, B, C] });
    const issues = stayIssues(trip);
    expect(issues.get('A')).toEqual(['다른 숙박과 중복']);
    expect(issues.get('B')).toEqual(expect.arrayContaining(['여행 기간 밖', '다른 숙박과 중복']));
    expect(issues.get('C')).toEqual(expect.arrayContaining(['여행 기간 밖', '다른 숙박과 중복']));
  });

  it('stayIssues: 날짜 미정 여행은 기간 검사를 하지 않는다', () => {
    const trip = createTrip({ stays: [A] });
    expect(stayIssues(trip).get('A')).toEqual([]);
  });
});
