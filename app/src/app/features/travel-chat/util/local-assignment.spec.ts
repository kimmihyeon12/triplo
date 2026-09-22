import { describe, expect, it } from 'vitest';
import { createStop, createTrip } from '../../trips/util/factories';
import { answerLocally } from './local-answer';
import { applyDraft, previewDraft } from './chat-draft';

describe('local bulk assignment', () => {
  const trip = { ...createTrip({ title: '여행' }), startDate: '2026-10-01', endDate: '2026-10-03',
    stops: [createStop({ name: 'A' }), createStop({ name: 'B' })] };
  it('resolves a day without a model', () => {
    expect(answerLocally('미배치 장소 모두 1일차로 배정해', trip, [])?.edit)
      .toEqual({ action: 'assign-unassigned', date: '2026-10-01' });
    expect(answerLocally('미배치 장소 모두 1일차로 배정해요', trip, [])?.edit)
      .toEqual({ action: 'assign-unassigned', date: '2026-10-01' });
  });
  it('resolves today and rejects conflicting dates', () => {
    expect(answerLocally('미배치 장소 오늘 날짜 1일차로 모두 배정해', trip, [], '2026-10-01')?.edit)
      .toEqual({ action: 'assign-unassigned', date: '2026-10-01' });
    expect(answerLocally('미배치 장소 오늘 날짜 1일차로 모두 배정해', trip, [], '2026-10-02')?.edit).toBeNull();
  });
  it.each(['미배치 장소 모두 9일차로 배정해', '미배치 장소 카페만 모두 1일차로 배정해', '미배치 장소 모두 1일차로 배정하지 마'])('clarifies unsafe requests: %s', text => {
    expect(answerLocally(text, trip, [])?.edit).toBeNull();
  });
  it('previews, assigns stored stops, and rejects stale confirmation', () => {
    const draft = { action: 'assign-unassigned' as const, date: '2026-10-01', stopIds: trip.stops.map(s => s.id) };
    expect(previewDraft(trip, draft).applicable).toBe(true);
    const next = applyDraft(trip, draft);
    expect(next.stops.map(s => s.date)).toEqual(['2026-10-01', '2026-10-01']);
    expect(next.stops[0].location).toEqual(trip.stops[0].location);
    expect(previewDraft(next, draft).applicable).toBe(false);
    expect(applyDraft(next, draft)).toBe(next);
  });
  it('supports tomorrow and ISO dates, and clarifies missing trip/dates/targets', () => {
    expect(answerLocally('미배치 장소 전부 내일로 옮겨줘', trip, [], '2026-10-01')?.edit)
      .toEqual({ action: 'assign-unassigned', date: '2026-10-02' });
    expect(answerLocally('미배치 장소 전체 2026-10-03으로 배정해', trip, [])?.edit)
      .toEqual({ action: 'assign-unassigned', date: '2026-10-03' });
    for (const context of [null, { ...trip, startDate: null }, { ...trip, stops: [] }]) {
      expect(answerLocally('미배치 장소 모두 1일차로 배정해', context, [])?.edit).toBeNull();
    }
  });
  it('rejects removed/excluded targets and shortened periods without partial changes', () => {
    const draft = { action: 'assign-unassigned' as const, date: '2026-10-03', stopIds: trip.stops.map(s => s.id) };
    for (const changed of [
      { ...trip, stops: trip.stops.slice(1) },
      { ...trip, stops: trip.stops.map((s, i) => i === 0 ? { ...s, excluded: true } : s) },
      { ...trip, endDate: '2026-10-02' },
    ]) {
      expect(previewDraft(changed, draft).applicable).toBe(false);
      expect(applyDraft(changed, draft)).toBe(changed);
    }
  });
  it('keeps new unassigned stops out of an existing draft and appends in snapshot order', () => {
    const draft = { action: 'assign-unassigned' as const, date: '2026-10-01', stopIds: trip.stops.map(s => s.id) };
    const changed = { ...trip, stops: [...trip.stops, createStop({ id: 'existing', date: draft.date }), createStop({ id: 'new' })] };
    const next = applyDraft(changed, draft);
    expect(next.stops.find(s => s.id === 'new')?.date).toBeNull();
    expect(next.stops.filter(s => s.date === draft.date).sort((a, b) => a.order - b.order).map(s => s.id))
      .toEqual(['existing', ...draft.stopIds]);
  });
});
