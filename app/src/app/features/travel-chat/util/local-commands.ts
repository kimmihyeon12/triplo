import { addDays, diffDays, isIsoDate, todayIso, validateTripDates } from '../../../shared/util/dates';
import type { Trip, TripStop } from '../../trips/model/trip';
import { placeStopOnDate, removeStop } from '../../trips/util/itinerary';
import { applyPeriodChange, periodChangeImpact } from '../../trips/util/period';
import { change, type LocalResult } from './local-command-draft';
import { commandDate, commandTargets } from './local-command-targets';
import { localQuery } from './local-queries';
import { isDistributeRequest } from './local-distribute';

const HELP = '장소 이름과 변경할 값을 명확히 알려 주세요. 예: 오죽헌 2일차로 옮겨 / 오죽헌 메모에 입장권 확인 추가해';
/** 체류시간은 화면에서 없앴다(2026-09-30 사용자 결정). 저장값은 보유하지만 명령으로 바꾸거나 세지 않는다. */
const DATE_HELP = '여행 날짜는 이렇게 바꿀 수 있어요. 예: 여행 오늘부터로 옮겨 / 여행 전체를 2일 앞으로 당겨 / 여행 시작일을 2026-10-10으로 바꿔';
const STAY_NOTICE = '체류시간은 이제 일정에 따로 적지 않아요. 필요하면 비고(메모)에 적어 주세요. 예: 오죽헌 메모에 체류 1시간 추가해';
/** 장소·숙박 날짜를 함께 옮긴다. 미배치 장소는 그대로 둔다. */
function shiftTrip(trip: Trip, delta: number): Trip {
  return { ...trip, startDate: addDays(trip.startDate!, delta), endDate: addDays(trip.endDate!, delta), stops: trip.stops.map(s => ({ ...s, date: s.date ? addDays(s.date, delta) : null })), stays: trip.stays.map(s => ({ ...s, checkIn: addDays(s.checkIn, delta), checkOut: addDays(s.checkOut, delta) })) };
}
const DAY = String.raw`오늘|내일|모레|\d{4}-\d{2}-\d{2}|\d{1,2}\s*월\s*\d{1,2}\s*일`;
/** '날짜 오늘부터 내일까지로 설정'처럼 여행 기간을 정하는 말(2026-10-07 사용자 제보: AI로 넘어가 장소 코스만 제안받았다). */
const PERIOD = new RegExp(String.raw`^(?:(?:여행|일정)\s*)?(?:날짜|기간|일정)(?:을|를)?\s*(${DAY})\s*부터\s*(${DAY})\s*까지\s*(?:으로|로)?\s*(?:설정|변경|바꿔|정해|해)\S*[.!?]*$`);

/** 말한 날을 YYYY-MM-DD로 바꾼다. 'M월 D일'은 올해로 본다. */
function dayOf(token: string, today: string): string {
  if (token === '오늘') return today;
  if (token === '내일') return addDays(today, 1);
  if (token === '모레') return addDays(today, 2);
  const md = token.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (md) return `${today.slice(0, 4)}-${md[1]!.padStart(2, '0')}-${md[2]!.padStart(2, '0')}`;
  return token;
}

const END = '(?:해줘|해주세요|해요|해|줘|주세요|바꿔줘|바꿔|변경해|설정해|설정|수정해|수정)?[.!?]*';

function select(text: string, trip: Trip, today: string, includeExcluded = false): TripStop[] | string {
  let rest = text;
  for (const stop of [...trip.stops].sort((a,b) => b.name.length - a.name.length)) if (stop.name) rest = rest.split(stop.name).join('');
  rest = rest.replace(/\d{4}-\d{2}-\d{2}|\d+\s*일차|미배치|카페|식당|식사|여유시간|장소|오늘|내일|이번|일정|전체|전부|모두|중|만|이랑|랑|하고|과|와|의|에서|에|을|를|은|는|들|다|둘|,|\s/g, '');
  if (rest) return HELP;
  return commandTargets(text, trip, today, includeExcluded);
}

export function localCommand(input: string, trip: Trip | null, today = todayIso()): LocalResult | null {
  let text = input.trim();
  if (/(?:\d+일차|오늘|내일|\d{4}-\d{2}-\d{2})(?:으로|로)$/.test(text)) text += ' 옮겨';
  if (/체류시간/.test(text)) return { text: STAY_NOTICE };
  // 여러 날에 나눠 담기는 앱의 나눠 담기(local-distribute)가 맡는다. '옮겨'가 있어도 여기서 가로채지 않는다(2026-10-07).
  const named = !!trip?.stops.some(s => s.name && text.includes(s.name));
  if (isDistributeRequest(text) && !named) return null;
  // 장소를 말했으면 '알아서'는 맡긴다는 말일 뿐이다. 빼고 장소 명령으로 읽는다.
  text = text.replace(/\s*(?:너가|네가|니가)?\s*알아서\s*/g, ' ').trim();
  if (/^(?:로컬 명령|내부 명령|할 수 있는 일|명령어)(?: 알려줘| 보여줘)?$/.test(text)) return { text: '일정 조회, 미배치 배정, 장소 날짜·순서·고정 시각·메모·제외, 여행 제목·날짜 변경, 중복·시간 충돌·숙박 누락 조회, 경비 조회·기록·예산, 변경 되돌리기를 AI 없이 처리해요.' };
  const period = text.match(PERIOD);
  if (period) {
    if (!trip) return { text: '먼저 날짜를 정할 여행을 열어 주세요.' };
    const start = dayOf(period[1]!, today);
    const end = dayOf(period[2]!, today);
    const valid = validateTripDates(start, end);
    if (!valid.ok) return { text: valid.message };
    // 여행 편집 화면과 같다. 새 기간 밖의 장소는 지우지 않고 미배치로 옮기고, 숙박은 그대로 둔다.
    const impact = periodChangeImpact(trip, start, end);
    const notes = [
      impact.displacedStops.length ? `기간 밖 장소 ${impact.displacedStops.length}곳은 미배치로 옮겨요` : '',
      impact.outOfRangeStays.length ? `숙박 ${impact.outOfRangeStays.length}곳은 기간 밖에 그대로 남아요` : '',
    ].filter(Boolean).join(', ');
    return change(trip, applyPeriodChange(trip, start, end), `여행 날짜 ${start} ~ ${end}${notes ? ` (${notes})` : ''}`);
  }
  const editing = /옮|이동|시작하게|배정|배치|바꿔|변경|수정|고정|해제|메모|제외|포함|복원|미뤄|당겨|맨 앞|맨 뒤|취소|삭제|지워|빼줘|미정으로/.test(text.replace(/미배치/g, ''));
  const querying = /일정|장소|미배치|숙소|숙박|몇\s*일차|중복|충돌|겹치|카페|좌표/.test(text) && /보여|알려|찾아|합계|몇|없|누락|복사|내보내|넣었/.test(text);
  // 화면 열기는 여는 대상(가계부·지도·일정)이 있을 때만 명령이다. '불국사 몇 시에 열어'처럼
  // 영업시간을 묻는 말까지 가로채 AI가 답하지 못했다(2026-09-30).
  const openScreen = /(?:경비|가계부|지출|지도|일정)[^.?!]*열어/.test(text);
  if (!editing && !querying && !openScreen) return null;
  // Recommendations and new-place creation belong to the existing provider flow.
  if (/추천|갈 만|가볼|일정 짜|일정 만들어|장소 추가|카페.*넣어/.test(text) && !editing) return null;
  if (!trip) return { text: '먼저 수정하거나 조회할 여행을 열어 주세요.' };
  if (editing && /하지\s*마|말고|빼고|않|말아|말아줘|지\s*마|대신|아니라|하고 나서|그리고/.test(text)) return { text: '제외 조건이나 여러 작업을 한 번에 적용하지 않아요. 변경할 대상과 작업을 하나씩 알려 주세요.' };
  if (/미배치/.test(text) && /모두|전부|전체/.test(text) && /배정|배치/.test(text) && !/카페|식사|식당|여유시간/.test(text)) return null;
  const query = !editing ? localQuery(text, trip, today) : null;
  if (query) return query;
  if (openScreen) {
    if (/경비|가계부|지출/.test(text)) return { text: '여행 가계부를 열 수 있어요.', localLink: `/trips/${encodeURIComponent(trip.id)}/expenses` };
    if (/지도|일정/.test(text)) {
      const date = commandDate(text, trip, today);
      if (/일차|오늘|내일/.test(text) && !date) return {text: '여행 기간 안의 날짜를 지정해 주세요.'};
      return { text: '해당 일정 화면을 열 수 있어요.', localLink: `/trips/${encodeURIComponent(trip.id)}?tab=days${date ? `&day=${date}` : ''}` };
    }
  }
  let match = text.match(new RegExp(`^여행 (?:이름|제목)(?:을|를)? (.+?)(?:으로|로) ${END}$`));
  if (match) {
    const title = match[1].trim();
    return title.length > 80 ? { text: '여행 제목은 80자 이내로 입력해 주세요.' } : change(trip, { ...trip, title }, '여행 제목 변경');
  }
  // '일정 오늘자로 변경'처럼 여행·일정과 날짜만 말하면 시작일을 그날로 옮긴다(2026-10-07 사용자 제보).
  // 장소만 옮기려면 '1일차 장소 전부 오늘로 옮겨'처럼 장소를 말한다.
  match = text.match(/^(?:여행|일정)(?:\s*전체)?(?:을|를)?\s*(오늘|내일|\d{4}-\d{2}-\d{2})\s*(?:부터|자)?\s*(?:으로|로|에)?\s*(?:시작하게\s*)?(?:옮겨|이동해|바꿔|변경해|변경|당겨|미뤄|해)?(?:줘|주세요)?[.!?]*$/);
  if (match) {
    if (!trip.startDate || !trip.endDate) return { text: '먼저 여행 날짜를 정해 주세요.' };
    const start = match[1] === '오늘' ? today : match[1] === '내일' ? addDays(today, 1) : match[1];
    if (!isIsoDate(start)) return { text: '날짜를 YYYY-MM-DD 형식으로 알려 주세요.' };
    const delta = diffDays(trip.startDate, start);
    if (delta === 0) return { text: `여행이 이미 ${start}에 시작해요.` };
    if (Math.abs(delta) > 3650) return {text: '날짜 이동은 3650일 이내로 지정해 주세요.'};
    return change(trip, shiftTrip(trip, delta), `여행 시작일 ${start}로 이동`);
  }
  match = text.match(/^여행 전체(?:를)? (하루|\d+일) (뒤로 미뤄|앞으로 당겨)(?:줘)?[.!?]*$/);
  if (match) {
    if (!trip.startDate || !trip.endDate) return { text: '먼저 여행 날짜를 정해 주세요.' };
    const delta = (match[1] === '하루' ? 1 : parseInt(match[1])) * (match[2].startsWith('뒤') ? 1 : -1);
    if (Math.abs(delta) > 3650) return {text: '날짜 이동은 3650일 이내로 지정해 주세요.'};
    return change(trip, shiftTrip(trip, delta), `여행 전체 ${delta}일 이동`);
  }
  if (/^여행 날짜(?:를)? (?:아직 )?미정으로 (?:해줘|바꿔)$/.test(text)) {
    if (trip.stays.length) return { text: '숙박 날짜가 연결되어 있어요. 숙박을 먼저 정리한 뒤 날짜를 미정으로 바꿔 주세요.' };
    const unassigned = trip.stops.filter(s => s.date !== null).reduce((next, s) => placeStopOnDate(next, s.id, null), trip);
    return change(trip, { ...unassigned, startDate: null, endDate: null }, '여행 날짜 미정 · 모든 장소 미배치');
  }
  match = text.match(/^여행 (시작일|종료일)(?:을|를)? (\d{4}-\d{2}-\d{2})(?:으로|로) (?:바꿔|변경해)(?:줘)?$/);
  if (match) {
    const next = { ...trip, [match[1] === '시작일' ? 'startDate' : 'endDate']: match[2] };
    if (!isIsoDate(match[2]) || !next.startDate || !next.endDate || diffDays(next.startDate, next.endDate) < 0) return { text: '시작일과 종료일을 올바른 YYYY-MM-DD 날짜로 정해 주세요.' };
    if (next.stops.some(s => s.date && (s.date < next.startDate! || s.date > next.endDate!)) || next.stays.some(s => s.checkIn < next.startDate! || s.checkOut > next.endDate!)) return { text: '새 기간 밖에 장소나 숙박이 있어요. 전체 여행 날짜 이동을 사용하거나 해당 일정을 먼저 옮겨 주세요.' };
    return change(trip, next, `여행 ${match[1]} 변경`);
  }
  const update = (selector: string, patch: Partial<TripStop>, title: string, includeExcluded = false): LocalResult => {
    const targets = select(selector, trip, today, includeExcluded);
    if (typeof targets === 'string') return { text: targets };
    if (!targets.length) return { text: '조건에 맞는 저장된 장소가 없어요.' };
    const ids = new Set(targets.map(s => s.id));
    return change(trip, { ...trip, stops: trip.stops.map(s => ids.has(s.id) ? { ...s, ...patch } : s) }, title);
  };
  match = text.match(/^(.+?)\s*(?:을|를)?\s*(\d+\s*일차|첫날|오늘|내일|\d{4}-\d{2}-\d{2})(?:으로|로|에)\s*(?:옮겨|이동해|배정해|배치해)(?:줘|주세요)?[.!?]*$/);
  if (match) {
    const date = commandDate(match[2], trip, today);
    if (!date) return { text: '여행 기간 안의 날짜를 지정해 주세요.' };
    const targets = select(match[1], trip, today);
    if (typeof targets === 'string') return {text: targets};
    if (!targets.length) return { text: '옮길 장소가 없어요.' };
    const next = [...targets].sort((a,b) => a.order - b.order).reduce((value, s) => s.date === date ? value : placeStopOnDate(value, s.id, date), trip);
    return change(trip, next, `${targets.length}곳 → ${match[2]}`);
  }
  match = text.match(/^(.+?)\s*(?:미배치로 (?:옮겨|돌려|바꿔)|날짜 배정 취소해)(?:줘)?$/);
  if (match) {
    const targets = select(match[1], trip, today);
    if (typeof targets === 'string') return {text: targets};
    if (!targets.length) return {text: '옮길 장소가 없어요.'};
    return change(trip, targets.filter(s => s.date !== null).reduce((next, s) => placeStopOnDate(next, s.id, null), trip), '장소 미배치로 변경');
  }
  match = text.match(/^(.+?)\s*(?:방문 시각 |시각 )?고정(?:을)? (?:전부 |모두 )?(?:해제해|풀어)(?:줘)?$/);
  if (match) return update(match[1], {fixedTime: null}, '방문 시각 고정 해제');
  match = text.match(/^(.+?)\s+(?:(오전|오후)\s*)?(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})분)?)(?:으로|로)?\s*(?:고정해|설정해)(?:줘)?$/);
  if (match) {
    let hours = Number(match[3]); const minutes = Number(match[4] ?? match[5] ?? 0);
    if (minutes > 59 || hours > 23 || (match[2] && (hours < 1 || hours > 12))) return {text: '올바른 시각을 입력해 주세요. 예: 오후 2시 또는 14:00'};
    if (match[2]) hours = hours % 12 + (match[2] === '오후' ? 12 : 0);
    return update(match[1], {fixedTime: `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`}, '방문 시각 설정');
  }
  match = text.match(/^(.+?)\s*메모(?:에|를)?\s+(.+?)\s+(추가해|바꿔|수정해)(?:줘)?$/);
  if (match) {
    const targets = select(match[1], trip, today);
    if (typeof targets === 'string') return {text: targets};
    if (targets.length !== 1) return {text: '메모를 수정할 장소 하나를 지정해 주세요.'};
    return update(match[1], {memo: match[3] === '추가해' ? [targets[0].memo, match[2]].filter(Boolean).join('\n') : match[2]}, '장소 메모 변경');
  }
  match = text.match(/^(.+?)\s*(?:일정에서 )?(제외해|다시 포함해|포함해|복원해)(?:줘)?$/);
  if (match) return update(match[1], {excluded: match[2] === '제외해'}, '일정 포함 여부 변경', true);
  match = text.match(/^(.+?)\s*(?:을|를)?\s*맨 (앞|뒤)(?:으로)?(?: 옮겨| 이동해)?(?:줘)?$/);
  const swap = text.match(/^(.+?)\s*순서 (?:바꿔|교환해)(?:줘)?$/);
  if (match || swap) {
    const targets = select((match ?? swap)![1], trip, today);
    if (typeof targets === 'string') return {text: targets};
    if (targets.length !== (match ? 1 : 2) || targets.some(s => s.date !== targets[0].date)) return {text: '같은 날짜의 장소를 지정해 주세요. 맨 앞·뒤는 한 곳, 순서 교환은 두 곳이 필요해요.'};
    const ordered = trip.stops.filter(s => s.date === targets[0].date).sort((a,b) => a.order - b.order).map(s => s.id);
    if (match) { ordered.splice(ordered.indexOf(targets[0].id), 1); if (match[2] === '앞') ordered.unshift(targets[0].id); else ordered.push(targets[0].id); }
    else { const a = ordered.indexOf(targets[0].id), b = ordered.indexOf(targets[1].id); [ordered[a], ordered[b]] = [ordered[b], ordered[a]]; }
    return change(trip, { ...trip, stops: trip.stops.map(s => ordered.includes(s.id) ? {...s, order: ordered.indexOf(s.id)} : s) }, '장소 순서 변경');
  }
  // Existing whole-unassigned assignment and coordinate sorting retain their established flow.
  if (/미배치/.test(text) && /모두|전부|전체/.test(text) && /배정|배치/.test(text)) return null;
  if (/^(?:동선 정리|순서 정리|순서정리|동선 최적화)(?:해줘|해|줘)?$/.test(text)) return null;
  if (/삭제|지워|빼줘|빼 줘/.test(text)) {
    const selector = text.replace(/(?:삭제해|삭제|지워|빼줘|빼 줘)(?:줘)?[.!?]*$/, '').trim();
    const targets = select(selector, trip, today, true);
    if (typeof targets === 'string') return {text: targets};
    if (!targets.length) return {text: '삭제할 저장된 장소가 없어요.'};
    return change(trip, targets.reduce((next, s) => removeStop(next, s.id), trip), `${targets.length}곳 삭제`);
  }
  if (editing && /^(?:여행|일정)/.test(text) && /날짜|시작|오늘|내일|\d{4}-\d{2}-\d{2}/.test(text)) return { text: DATE_HELP };
  return editing ? {text: HELP} : null;
}
