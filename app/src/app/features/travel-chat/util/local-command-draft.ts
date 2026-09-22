import type { Trip, TripStop } from '../../trips/model/trip';
import type { LocalChangeDraft } from '../model/chat';

/** Persistence timestamps do not invalidate an otherwise identical preview. */
export function tripVersion(trip: Trip): string {
  return JSON.stringify({ ...trip, updatedAt: '' });
}

export function localChangeValid(trip: Trip, draft: LocalChangeDraft): boolean {
  return trip.id === draft.before.id && trip.id === draft.after.id
    && tripVersion(trip) === tripVersion(draft.before);
}

export interface LocalResult {
  text: string;
  draft?: LocalChangeDraft;
  localLink?: string;
  copyText?: string;
}

export function change(before: Trip, after: Trip, title: string): LocalResult {
  if (tripVersion(before) === tripVersion(after)) return { text: '이미 요청하신 상태예요.' };
  return { text: `${title}. 변경 내용을 확인해 주세요.`, draft: { action: 'local-change', title, before, after } };
}

export function describeStop(stop: TripStop): string {
  return `${stop.name} · ${stop.date ?? '미배치'} · 순서 ${stop.order + 1} · ${stop.stayMinutes === null ? '체류 미정' : `${stop.stayMinutes}분`} · ${stop.fixedTime ?? '시각 미정'}${stop.excluded ? ' · 제외' : ''}${stop.memo ? ` · 메모: ${stop.memo}` : ''}`;
}
