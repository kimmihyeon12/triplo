import type { IsoDate, Trip, TripStop } from '../../trips/model/trip';
import { todayIso } from '../../../shared/util/dates';
import { assignmentAnswer } from './local-assignment';
import { OUT_OF_SCOPE_REPLY, type ChatReply } from '../model/chat';
import { nearestOrder } from './chat-draft';
import { classifyQuestion } from './chat-scope';
import { listChips, pickRandomRegion, tripChips, regionChips } from './chat-suggestions';

/**
 * 모델을 부르기 전에 앱이 직접 답할 수 있는지 본다. 답할 수 있으면 그 답을,
 * 아니면 null을 돌려주고 호출은 제공자에게 넘어간다.
 *
 * 가로채는 이유는 두 가지다. 첫째, 무료 하루 한도를 앱 전체가 나눠 쓰므로
 * 정해진 답을 받으려고 호출을 쓰면 정작 필요한 탐색에서 모자란다. 둘째,
 * 저장된 좌표로 계산하는 편이 모델의 짐작보다 정확하다. 순서 정리는 답이
 * 데이터에 이미 있으므로 물어볼 이유가 없다.
 *
 * 애매하면 가로채지 않는다. 잘못 가로채면 사용자가 원하는 답을 영영 받지
 * 못하지만, 넘기면 모델이 답할 기회가 남는다.
 */

/** 갈 곳을 하나 뽑아 달라는 말. */
const RANDOM_WORDS = ['아무 데나', '아무데나', '랜덤', '무작위', '아무 곳', '골라줘', '뽑아줘'];

/** 하루 차례를 다시 매겨 달라는 말. */
const SORT_WORDS = ['순서 정리', '순서정리', '동선', '순서 바꿔', '순서바꿔', '최적화'];

/** 일정에서 빼 달라는 말. */
const REMOVE_WORDS = ['빼줘', '빼 줘', '삭제', '지워', '제외'];

function hasWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function reply(partial: Partial<ChatReply> & Pick<ChatReply, 'kind' | 'text'>): ChatReply {
  return {
    reference: null,
    chips: [],
    places: [],
    regions: [],
    edit: null,
    ...partial,
  };
}

export function answerLocally(
  input: string,
  trip: Trip | null,
  recentRegionCodes: readonly string[],
  today = todayIso(),
): ChatReply | null {
  const text = input.trim();
  if (!text) return null;
  const chips = trip ? tripChips(trip) : listChips();

  // 여행과 무관하거나 앱이 다루지 않는 일은 답이 정해져 있다.
  const kind = classifyQuestion(text);
  if (kind === 'refusal') return reply({ kind, text: OUT_OF_SCOPE_REPLY, chips });
  if (kind === 'outside')
    return reply({
      kind,
      text: '예약이나 교통편 구매는 아직 도와드리지 못해요. 대신 어디를 갈지 일정부터 함께 짜 볼까요?',
      chips,
    });

  const assignment = assignmentAnswer(text, trip, today);
  if (assignment) return assignment;
  if (hasWord(text, RANDOM_WORDS)) return randomRegionAnswer(recentRegionCodes);
  if (trip && hasWord(text, SORT_WORDS)) return sortAnswer(trip, chips);
  if (trip && hasWord(text, REMOVE_WORDS)) return removeAnswer(trip, text, chips);
  return null;
}

/**
 * 갈 곳을 하나 뽑는다. 지역은 고정 목록에서 앱이 고르므로 존재하지 않는
 * 지명이 나올 수 없다.
 *
 * 설계는 '왜 갈 만한지 설명하는 일'을 모델에 맡기기로 했으나, 여기서는
 * 호출 없이 지역과 다음 할 일만 알린다. 지어낸 설명을 붙이면 확인되지 않은
 * 말이 되고, 확인 링크를 붙일 대상도 없기 때문이다. 이어지는 질문에서
 * 모델이 그 지역을 설명한다.
 */
function randomRegionAnswer(
  recentRegionCodes: readonly string[],
): ChatReply | null {
  const region = pickRandomRegion(recentRegionCodes);
  if (!region) return null;
  return reply({
    kind: 'explore',
    text: `${region.name}은(는) 어떠세요? ${region.short} 지역이에요. 마음에 들면 일정을 짜 드릴게요.`,
    regions: [region.name],
    chips: regionChips(region.name),
  });
}

/**
 * 순서 정리. 답이 저장된 좌표에 이미 있으므로 모델을 부르지 않는다.
 *
 * 고정 시각이 있는 장소가 섞이면 손대지 않는다. 예약 시간을 지켜야 하는데
 * 차례를 바꾸면 그 시각에 다른 곳에 있게 된다. 이런 판단을 모델에게 맡기면
 * 지켜지는지 확인할 방법이 없다.
 */
function sortAnswer(trip: Trip, chips: readonly string[]): ChatReply {
  const byDate = new Map<IsoDate, TripStop[]>();
  for (const stop of trip.stops) {
    if (stop.excluded || !stop.date) continue;
    const group = byDate.get(stop.date) ?? [];
    group.push(stop);
    byDate.set(stop.date, group);
  }
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (days.length === 0)
    return reply({
      kind: 'explore',
      text: '아직 날짜에 배치된 장소가 없어요. 먼저 갈 곳을 담아 볼까요?',
      chips,
    });

  // 정리할 수 있는 날을 찾는다. 두 곳 이상이고 모두 좌표가 있어야 한다.
  const target = days.find(
    ([, stops]) =>
      stops.length >= 2 &&
      stops.every((s) => s.location !== null) &&
      stops.every((s) => s.fixedTime === null),
  );
  if (!target) {
    const fixed = days.some(([, stops]) => stops.some((s) => s.fixedTime !== null));
    return reply({
      kind: 'explore',
      text: fixed
        ? '시각을 고정한 장소가 있어 순서를 바꾸면 예약 시간과 어긋나요. 고정을 풀고 다시 요청해 주세요.'
        : '위치를 확인한 장소가 부족해 동선을 계산할 수 없어요. 장소를 검색해서 담으면 정리해 드릴게요.',
      chips,
    });
  }

  const [date, stops] = target;
  const sorted = stops.slice().sort((a, b) => a.order - b.order);
  const ordered = nearestOrder(sorted);
  // 이미 가까운 순서면 바꿀 것이 없다. 묻지 않은 일을 하지 않는다.
  if (ordered.every((id, i) => id === sorted[i]!.id))
    return reply({
      kind: 'explore',
      text: '지금 순서가 이미 가까운 곳부터 이어져 있어요. 그대로 두는 게 좋겠어요.',
      chips,
    });

  return reply({
    kind: 'draft',
    text: '이동 거리가 줄어드는 순서를 찾았어요. 확인해 보세요.',
    edit: { action: 'move', date },
    chips,
  });
}

/**
 * 이름을 대고 빼 달라는 요청. 저장된 장소 이름과 맞춰 본다.
 * 찾지 못하면 짐작해서 다른 곳을 지우지 않고 한 줄로 되묻는다.
 */
function removeAnswer(trip: Trip, text: string, chips: readonly string[]): ChatReply | null {
  const active = trip.stops.filter((s) => !s.excluded);
  const hit = active.filter((s) => s.name && text.includes(s.name));
  if (hit.length > 0)
    return reply({
      kind: 'draft',
      text: hit.length === 1 ? `${hit[0]!.name}을(를) 뺄까요?` : `${hit.length}곳을 뺄까요?`,
      edit: { action: 'remove', names: hit.map((s) => s.name) },
      chips,
    });

  // 뺄 대상을 말하지 않았으면 모델이 문맥에서 찾을 수도 있으므로 넘긴다.
  if (active.length === 0)
    return reply({ kind: 'explore', text: '아직 담긴 장소가 없어요.', chips });
  return reply({
    kind: 'explore',
    text: '어느 장소를 뺄지 찾지 못했어요. 일정에 있는 이름으로 다시 말씀해 주세요.',
    chips: active.slice(0, 4).map((s) => `${s.name} 빼줘`),
  });
}
