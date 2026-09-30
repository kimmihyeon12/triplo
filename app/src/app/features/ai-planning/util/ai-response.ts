import { parsePlanEstimate, type PlanEstimate } from '../../../shared/util/plan-estimate';
import type { PlanKind } from '../../trips/model/trip';
import type { AiMove, MoveMode } from '../model/ai-plan';

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
  readonly name: string;
  readonly kind: PlanKind;
}

function parseStart(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h! <= 23 && m! <= 59 ? value : null;
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
  name: string;
  kind: PlanKind;
  rawOrder: unknown;
  start: string | null;
  moveToNext: AiMove | null;
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
      day?: unknown; name?: unknown; kind?: unknown; estimate?: unknown;
      order?: unknown; start?: unknown; moveToNext?: unknown;
    };
    if (typeof item.day !== 'number' || !Number.isInteger(item.day)) continue;
    if (item.day < 1 || item.day > dayCount) continue;
    if (typeof item.name !== 'string') continue;
    const name = item.name.trim().slice(0, MAX_NAME);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      day: item.day,
      name,
      kind: KIND_BY_LABEL[String(item.kind ?? '')] ?? 'place',
      rawOrder: item.order,
      start: parseStart(item.start),
      moveToNext: parseMove(item.moveToNext),
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
      item.order = index + 1;
      if (item.start !== null && last !== null && item.start < last) item.start = null;
      if (item.start !== null) last = item.start;
    });
  }
}
