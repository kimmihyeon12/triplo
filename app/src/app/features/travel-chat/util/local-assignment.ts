import { addDays, diffDays, isIsoDate } from '../../../shared/util/dates';
import type { Trip } from '../../trips/model/trip';
import type { ChatReply } from '../model/chat';

/** Only a complete, explicit bulk command may select all unassigned stops. */
export function assignmentAnswer(text: string, trip: Trip | null, today: string): ChatReply | null {
  if (!/미\s*배치/.test(text) || !/배정|배치|옮|이동|넣/.test(text.replace(/미\s*배치/g, ''))) return null;
  const reply = (message: string, dates: string[] = []): ChatReply => ({
    kind: 'explore', text: message, reference: null, places: [], regions: [], edit: null,
    chips: dates.map(date => `미배치 장소 모두 ${date}로 배정해`),
  });
  if (!trip) return reply('여행을 열고 미배치 장소를 배정해 주세요.');
  if (!trip.startDate || !trip.endDate) return reply('먼저 여행 시작일과 종료일을 정해 주세요.');
  const dates: string[] = [];
  for (const match of text.matchAll(/(\d+)\s*일\s*차/g)) dates.push(addDays(trip.startDate, Number(match[1]) - 1));
  if (/첫날|첫째\s*날/.test(text)) dates.push(trip.startDate);
  if (text.includes('오늘')) dates.push(today);
  if (text.includes('내일')) dates.push(addDays(today, 1));
  for (const match of text.matchAll(/\d{4}-\d{2}-\d{2}/g)) dates.push(match[0]);
  const unique = [...new Set(dates)];
  const valid = unique.filter(date => isIsoDate(date) && date >= trip.startDate! && date <= trip.endDate!);
  // Strip only understood words. Unhandled qualifiers/negations must never widen the selection.
  const remainder = text
    .replace(/\d{4}-\d{2}-\d{2}|\d+\s*일\s*차|첫날|첫째\s*날|오늘|내일/g, '')
    .replace(/미\s*배치|장소|모두|전부|전체|지금|현재|날짜|배정|배치|옮겨|이동|넣어|해주세요|해줘|해요|해|주세요|줘|으로|로|에|을|를|들|좀|\s|[.!?]/g, '');
  if (remainder || !/모두|전부|전체/.test(text)) return reply('미배치 장소 전체를 배정할 날짜를 명확히 알려 주세요. 예: 미배치 장소 모두 1일차로 배정해');
  if (unique.length > 1) return reply('서로 다른 날짜를 말씀하셨어요. 어느 날짜로 배정할까요?', valid);
  if (!unique.length) return reply('몇 일차로 배정할까요?', [trip.startDate]);
  if (!valid.length) return reply('여행 기간 안의 날짜를 선택해 주세요.', [trip.startDate]);
  const targets = trip.stops.filter(s => !s.excluded && s.date === null);
  if (!targets.length) return reply('배정할 미배치 장소가 없어요.');
  const date = valid[0];
  return { ...reply(`미배치 장소 ${targets.length}곳을 ${diffDays(trip.startDate, date) + 1}일차(${date})의 기존 장소 뒤에 배정할게요. 확인 후 적용해 주세요.`),
    kind: 'draft', edit: { action: 'assign-unassigned', date } };
}
