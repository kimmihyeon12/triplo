import { describe, expect, it } from 'vitest';
import { createStop, createTrip } from '../../trips/util/factories';
import { localCommand } from './local-commands';
import { applyDraft } from './chat-draft';

const trip = createTrip({ title: '강릉 여행', startDate: '2026-10-01', endDate: '2026-10-03', stops: [
  createStop({ id: 'a', name: '오죽헌', date: '2026-10-01', order: 0, stayMinutes: 60 }),
  createStop({ id: 'b', name: '경포대', date: '2026-10-01', order: 1 }),
  createStop({ id: 'c', name: '커피집', kind: 'break' }),
] });
describe('local commands', () => {
  it.each([
    ['오죽헌 2일차로 옮겨', 'a', 'date', '2026-10-02'],
    ['오죽헌 체류시간 1시간 30분으로 바꿔', 'a', 'stayMinutes', 90],
    ['오죽헌 오후 2시로 고정해', 'a', 'fixedTime', '14:00'],
    ['오죽헌 메모에 입장권 확인 추가해', 'a', 'memo', '입장권 확인'],
    ['경포대 이번 일정에서 제외해', 'b', 'excluded', true],
    ['미배치 중 카페만 2일차로 옮겨', 'c', 'date', '2026-10-02'],
  ])('%s', (text, id, field, expected) => {
    const result = localCommand(text as string, trip)!;
    expect(result.draft).toBeTruthy();
    const next = applyDraft(trip, result.draft!);
    expect(next.stops.find(s => s.id === id)![field as 'date']).toBe(expected);
  });
  it('moves all day stops and supports explicit swapping', () => {
    const result = localCommand('1일차 장소 전부 2일차로 옮겨', trip)!;
    expect(applyDraft(trip, result.draft!).stops.slice(0, 2).map(s => s.date)).toEqual(['2026-10-02', '2026-10-02']);
    const swapped = applyDraft(trip, localCommand('경포대랑 오죽헌 순서 바꿔', trip)!.draft!);
    expect(swapped.stops.find(s => s.id === 'b')!.order).toBe(0);
  });
  it('renames and shifts all dates', () => {
    expect(applyDraft(trip, localCommand('여행 이름을 강릉 주말여행으로 바꿔', trip)!.draft!).title).toBe('강릉 주말여행');
    const next = applyDraft(trip, localCommand('여행 전체를 하루 뒤로 미뤄', trip)!.draft!);
    expect(next.startDate).toBe('2026-10-02');
    expect(next.stops[0].date).toBe('2026-10-02');
  });
  it('answers stored queries and distinguishes missing durations', () => {
    expect(localCommand('2일차 일정 보여줘', trip)?.text).toContain('없');
    expect(localCommand('체류시간 합계 알려줘', trip)?.text).toContain('미정 2');
    expect(localCommand('오죽헌 몇 일차에 넣었지?', trip)?.text).toContain('1일차');
    expect(localCommand('미배치 장소 알려줘', trip)?.text).toContain('커피집');
  });
  it.each(['오죽헌 9일차로 옮겨', '오죽헌 옮기지 마', '이 장소 맨 앞으로', '오죽헌 25:00으로 고정해'])('does not guess: %s', text => {
    expect(localCommand(text, trip)).not.toBeNull();
    expect(localCommand(text, trip)?.draft).toBeUndefined();
  });
  it('rejects duplicate names and stale snapshots', () => {
    expect(localCommand('오죽헌 2일차로 옮겨', { ...trip, stops: [...trip.stops, createStop({name:'오죽헌'})] })?.draft).toBeUndefined();
    const draft = localCommand('오죽헌 2일차로 옮겨', trip)!.draft!;
    const changed = { ...trip, title: '다른 제목' };
    expect(applyDraft(changed, draft)).toBe(changed);
  });
  it('leaves recommendations to AI', () => {
    expect(localCommand('비 오는 날 갈 만한 곳 추천해줘', trip)).toBeNull();
  });
  it('requires explicit deletion scope and respects named target date filters', () => {
    expect(localCommand('장소 삭제해', trip)?.draft).toBeUndefined();
    expect(localCommand('2일차 오죽헌 삭제해', trip)?.draft).toBeUndefined();
    expect(localCommand('미배치 오죽헌 삭제해', trip)?.draft).toBeUndefined();
  });
  it('appends to existing unassigned stops and renumbers the source day', () => {
    const next = applyDraft(trip, localCommand('오죽헌 미배치로 옮겨', trip)!.draft!);
    expect(next.stops.find(s => s.id === 'c')!.order).toBe(0);
    expect(next.stops.find(s => s.id === 'a')!.order).toBe(1);
    expect(next.stops.find(s => s.id === 'b')!.order).toBe(0);
  });
  it('supports short commands, bulk durations and undecided dates', () => {
    expect(localCommand('오죽헌 2일차로', trip)?.draft).toBeTruthy();
    expect(applyDraft(trip, localCommand('카페 체류시간 전부 40분으로', trip)!.draft!).stops[2].stayMinutes).toBe(40);
    const next = applyDraft(trip, localCommand('여행 날짜 미정으로 해줘', trip)!.draft!);
    expect(next.startDate).toBeNull();
    expect(new Set(next.stops.map(s => s.order)).size).toBe(next.stops.length);
    expect(localCommand('1일차 방문 시각 고정 전부 풀어', trip)?.text).not.toContain('명확히');
  });
  it('reports missing stays, duplicate candidates, and known time collisions', () => {
    expect(localCommand('숙소 안 정한 날짜 알려줘', trip)?.text).toContain('2026-10-01');
    const overlapping = {...trip, stops: trip.stops.map(s => ({...s, date:'2026-10-01', fixedTime:'14:00',stayMinutes:30}))};
    expect(localCommand('방문 시간이 겹치는 일정 찾아줘', overlapping)?.text).toContain('오죽헌 / 경포대');
    expect(localCommand('중복 장소 찾아줘', {...trip, stops:[...trip.stops, {...trip.stops[0],id:'duplicate'}]})?.text).toContain('중복 후보');
    expect(localCommand('2일차 지도 열어줘', trip)?.localLink).toContain('day=2026-10-02');
    expect(localCommand('일정 텍스트로 복사해줘', trip)?.copyText).toContain('오죽헌');
  });
});
