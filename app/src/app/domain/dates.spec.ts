import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  enumerateDays,
  formatKoreanDate,
  formatPeriod,
  nightsBetween,
  validateTripDates,
} from './dates';

describe('dates', () => {
  it('diffDays는 두 날짜의 일수 차이를 돌려준다', () => {
    expect(diffDays('2026-05-01', '2026-05-05')).toBe(4);
    expect(diffDays('2026-05-01', '2026-05-01')).toBe(0);
    expect(diffDays('2026-05-05', '2026-05-01')).toBe(-4);
  });

  it('addDays는 월·연 경계를 넘어 계산한다', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('nightsBetween: 5/1~5/5는 4박, 당일은 0박', () => {
    expect(nightsBetween('2026-05-01', '2026-05-05')).toBe(4);
    expect(nightsBetween('2026-05-01', '2026-05-01')).toBe(0);
  });

  it('enumerateDays는 시작·종료를 포함한 날짜 목록을 만든다', () => {
    expect(enumerateDays('2026-05-01', '2026-05-03')).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
    expect(enumerateDays('2026-05-01', '2026-05-01')).toEqual(['2026-05-01']);
  });

  it('enumerateDays는 종료가 시작보다 빠르면 빈 배열을 돌려준다', () => {
    expect(enumerateDays('2026-05-03', '2026-05-01')).toEqual([]);
  });

  it('validateTripDates: 둘 다 없으면 날짜 미정으로 유효', () => {
    expect(validateTripDates(null, null)).toEqual({ ok: true, undecided: true });
    expect(validateTripDates('', '')).toEqual({ ok: true, undecided: true });
  });

  it('validateTripDates: 한쪽만 있으면 오류', () => {
    const r = validateTripDates('2026-05-01', null);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('모두');
  });

  it('validateTripDates: 종료가 시작보다 빠르면 오류', () => {
    const r = validateTripDates('2026-05-05', '2026-05-01');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('종료일');
  });

  it('validateTripDates: 형식이 잘못되면 오류', () => {
    expect(validateTripDates('2026-5-1', '2026-05-02').ok).toBe(false);
  });

  it('formatKoreanDate는 월·일·요일을 표시한다', () => {
    expect(formatKoreanDate('2026-05-01')).toBe('5월 1일(금)');
    expect(formatKoreanDate('2026-05-01', { short: true })).toBe('5/1(금)');
  });

  it('formatPeriod는 기간과 N박 N+1일을 표시한다', () => {
    expect(formatPeriod('2026-05-01', '2026-05-05')).toBe('5월 1일(금) – 5월 5일(화) · 4박 5일');
    expect(formatPeriod('2026-05-01', '2026-05-01')).toBe('5월 1일(금) · 0박 1일');
    expect(formatPeriod(null, null)).toBe('날짜 미정');
  });
});
