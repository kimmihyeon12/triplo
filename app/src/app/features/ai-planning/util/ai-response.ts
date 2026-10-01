import { parsePlanEstimate, type PlanEstimate } from '../../../shared/util/plan-estimate';
import type { PlanKind } from '../../trips/model/trip';
import type { AiMove, ClosedInfo, MoveMode } from '../model/ai-plan';

export type { AiMove, MoveMode };

/**
 * 모델이 돌려준 응답을 우리 형식으로 바꾼다. 모델은 형식을 지키지 않을 수 있고
 * 없는 날짜나 빈 이름을 낼 수 있으므로, 스키마로 제한한 뒤에도 여기서 다시 검사한다.
 * 좌표·영업시간·주소는 모델에게 받지 않는다. 지어낸 값을 사실로 저장하지 않기 위해서다.
 */

/** 한 번에 담을 수 있는 최대 개수. 모델이 목록을 끝없이 늘리는 경우를 막는다. */
const MAX_ITEMS = 40;
/** 장소 이름의 최대 길이. 넘으면 잘라 담는다. */
const MAX_NAME = 60;

/** 모델이 쓰는 분류 라벨. '장소'는 이전 응답의 라벨이라 관광으로 읽는다. */
const KIND_BY_LABEL: Readonly<Record<string, PlanKind>> = {
  관광: 'place',
  장소: 'place',
  액티비티: 'activity',
  식사: 'meal',
  카페: 'break',
  쇼핑: 'shopping',
  기타: 'other',
  숙소: 'stay',
};

const MOVE_MODES: readonly MoveMode[] = ['도보', '대중교통', '자가용', '택시'];

export interface AiItem {
  readonly estimate?: PlanEstimate;
  readonly day: number;
  /** 그날 안의 방문 순서(1부터). 모델 순서가 쓸 수 없으면 응답 순서로 매긴다. */
  readonly order: number;
  /** 추천 도착 시각 'HH:mm'. 형식이 틀리거나 앞 항목보다 이르면 미정이다. */
  readonly start: string | null;
  readonly moveToNext: AiMove | null;
  /** AI 추정 휴무 정보. 없거나 잘못되면 null이다. */
  readonly closed?: ClosedInfo | null;
  readonly name: string;
  readonly kind: PlanKind;
  /** 후보로 고르는 요청에서 고른 후보의 id. 이름 방식 응답에는 없다. */
  readonly ref?: string;
}

function parseStart(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h! <= 23 && m! <= 59 ? value : null;
}

/** 휴무 정보는 onDay가 참·거짓이고 설명이 있을 때만 받는다. 설명은 짧게 자른다. */
function parseClosed(value: unknown): ClosedInfo | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { onDay?: unknown; note?: unknown };
  if (typeof v.onDay !== 'boolean' || typeof v.note !== 'string') return null;
  const note = v.note.trim().slice(0, 80);
  return note ? { onDay: v.onDay, note } : null;
}

function parseMove(value: unknown): AiMove | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { mode?: unknown; minutes?: unknown };
  if (!MOVE_MODES.includes(v.mode as MoveMode)) return null;
  if (typeof v.minutes !== 'number' || !Number.isInteger(v.minutes) || v.minutes < 1 || v.minutes > 600) return null;
  return { mode: v.mode as MoveMode, minutes: v.minutes };
}

interface Draft {
  day: number;
  ref?: string;
  name: string;
  kind: PlanKind;
  rawOrder: unknown;
  start: string | null;
  moveToNext: AiMove | null;
  closed: ClosedInfo | null;
  estimate?: PlanEstimate;
  order: number;
}

export function parseAiItems(content: string, dayCount: number): AiItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  const raw = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(raw)) return [];

  const out: Draft[] = [];
  // 같은 장소를 두 번 담지 않는다. 앞뒤 공백만 다른 이름도 같은 것으로 본다.
  const seen = new Set<string>();
  for (const entry of raw) {
    if (out.length >= MAX_ITEMS) break;
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as {
      day?: unknown; name?: unknown; kind?: unknown; estimate?: unknown; ref?: unknown;
      order?: unknown; start?: unknown; moveToNext?: unknown; closed?: unknown;
    };
    if (typeof item.day !== 'number' || !Number.isInteger(item.day)) continue;
    if (item.day < 1 || item.day > dayCount) continue;
    if (typeof item.name !== 'string') continue;
    const name = item.name.trim().slice(0, MAX_NAME);
    const kind = KIND_BY_LABEL[String(item.kind ?? '')] ?? 'place';
    // 숙소는 여러 밤 같은 곳에 묵으므로 날마다 한 번씩 받는다. 담을 때 이어지는 밤을 합친다.
    // 후보 id는 c와 숫자뿐이다. 다른 모양은 없는 것으로 본다.
    const ref = typeof item.ref === 'string' && /^c\d{1,3}$/.test(item.ref) ? item.ref : undefined;
    const id = ref ?? name;
    const key = kind === 'stay' ? `stay:${item.day}:${id}` : id;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({
      day: item.day,
      ...(ref ? { ref } : {}),
      name,
      kind,
      rawOrder: item.order,
      start: parseStart(item.start),
      moveToNext: parseMove(item.moveToNext),
      closed: parseClosed(item.closed),
      ...(item.estimate !== undefined ? { estimate: parsePlanEstimate(item.estimate) } : {}),
      order: 0,
    });
  }
  settleOrder(out);
  return out.map(({ rawOrder: _raw, ...item }) => item);
}

/**
 * 일차마다 방문 순서를 정한다. 모델 순서가 모두 1 이상 정수이고 겹치지 않을 때만
 * 믿고, 아니면 응답 순서를 쓴다. 순서를 정한 뒤 앞 항목보다 이른 시각은 버린다.
 * 순서는 장소 배치라 믿을 만하지만, 거꾸로 가는 시각은 둘 중 하나가 틀린 값이다.
 */
function settleOrder(items: Draft[]): void {
  const days = new Map<number, Draft[]>();
  for (const item of items) days.set(item.day, [...(days.get(item.day) ?? []), item]);
  for (const group of days.values()) {
    const orders = group.map((i) => i.rawOrder);
    const usable =
      orders.every((o) => typeof o === 'number' && Number.isInteger(o) && o >= 1) &&
      new Set(orders).size === orders.length;
    const sorted = usable ? [...group].sort((a, b) => (a.rawOrder as number) - (b.rawOrder as number)) : group;
    let last: string | null = null;
    sorted.forEach((item, index) => {
      // 쓸 수 있는 모델 순서는 그대로 둔다. 다시 매기면 빠진 항목의 자리가 사라져
      // 이어지지 않은 두 곳 사이에 모델 이동시간이 붙는다.
      item.order = usable ? (item.rawOrder as number) : index + 1;
      if (item.start !== null && last !== null && item.start < last) item.start = null;
      if (item.start !== null) last = item.start;
    });
  }
}
