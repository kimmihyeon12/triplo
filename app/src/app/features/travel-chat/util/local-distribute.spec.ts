import { describe, expect, it } from 'vitest';
import { createStop, createTrip } from '../../trips/util/factories';
import type { Trip } from '../../trips/model/trip';
import { answerLocally } from './local-answer';
import { applyDraft, previewDraft } from './chat-draft';
import type { DistributeDraft } from '../model/chat';

const at = (name: string, lat: number, lng: number) => createStop({ name, location: { lat, lng } });

function trip(stops = [at('A', 37, 127), at('B', 37, 127.01), at('C', 38, 128), at('D', 38, 128.01), at('E', 39, 129), at('F', 39, 129.01)]): Trip {
  return { ...createTrip({ title: '순천 여행' }), startDate: '2026-10-02', endDate: '2026-10-04', stops };
}

const edit = (text: string, t = trip()) => answerLocally(text, t, [], '2026-10-01')?.edit;

describe('저장된 장소를 여러 날에 나눠 담기', () => {
  it.each([
    '일차에 해당여행 모두담아',
    '10월2일부터 4일까지 코스 구성해줘',
    '저장된 장소 날짜별로 나눠줘',
    '장소들 일차별로 모두 배치해',
  ])('모델 없이 나눠 담기 초안을 만든다: %s', (text) => {
    const result = edit(text);
    expect(result?.action).toBe('distribute');
  });

  it('가까운 곳끼리 같은 날에 묶고 날마다 비슷하게 나눈다', () => {
    const t = trip();
    const result = answerLocally('일차에 해당여행 모두담아', t, [], '2026-10-01')?.edit as { assignments: { stopId: string; date: string }[] };
    const dateOf = (name: string) => result.assignments.find((a) => a.stopId === t.stops.find((s) => s.name === name)!.id)!.date;
    expect(dateOf('A')).toBe(dateOf('B'));
    expect(dateOf('C')).toBe(dateOf('D'));
    expect(dateOf('E')).toBe(dateOf('F'));
    expect(new Set([dateOf('A'), dateOf('C'), dateOf('E')]).size).toBe(3);
  });

  it('범위를 말하면 그 날짜에만 나눈다', () => {
    const result = edit('1일차부터 2일차까지 나눠 담아') as { assignments: { date: string }[] };
    expect(new Set(result.assignments.map((a) => a.date))).toEqual(new Set(['2026-10-02', '2026-10-03']));
  });

  it('한 날짜로 모두 옮기는 명령은 그대로 한 날짜 배정이다', () => {
    expect(edit('미배치 장소 모두 1일차로 배정해')).toEqual({ action: 'assign-unassigned', date: '2026-10-02' });
  });

  it('날짜가 없는 장소가 없거나 여행 날짜가 없으면 알리고 바꾸지 않는다', () => {
    const allDated = trip().stops.map((s) => ({ ...s, date: '2026-10-02' }));
    const r1 = answerLocally('일차에 해당여행 모두담아', { ...trip(), stops: allDated }, [], '2026-10-01');
    expect(r1?.edit).toBeNull();
    expect(r1?.text).toContain('날짜가 정해지지 않은 장소가 없어요');
    const r2 = answerLocally('일차에 해당여행 모두담아', { ...trip(), startDate: null, endDate: null }, [], '2026-10-01');
    expect(r2?.edit).toBeNull();
    expect(r2?.text).toContain('여행 날짜');
  });

  it('미리보기에서 날짜별로 보이고, 적용하면 날짜가 들어가며, 그사이 바뀌었으면 잠근다', () => {
    const t = trip();
    const draft: DistributeDraft = {
      action: 'distribute',
      assignments: [
        { stopId: t.stops[0]!.id, date: '2026-10-02' },
        { stopId: t.stops[2]!.id, date: '2026-10-03' },
      ],
    };
    const view = previewDraft(t, draft);
    expect(view.applicable).toBe(true);
    expect(view.after.map((r) => r.name)).toEqual(['1일차 · A', '2일차 · C']);
    const next = applyDraft(t, draft);
    expect(next.stops.find((s) => s.name === 'A')!.date).toBe('2026-10-02');
    expect(next.stops.find((s) => s.name === 'C')!.date).toBe('2026-10-03');
    expect(previewDraft(next, draft).applicable).toBe(false);
  });
});
