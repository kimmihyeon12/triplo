import type { StopKind } from '../../trips/model/trip';

/**
 * 모델이 돌려준 응답을 우리 형식으로 바꾼다. 모델은 형식을 지키지 않을 수 있고
 * 없는 날짜나 빈 이름을 낼 수 있으므로, 스키마로 제한한 뒤에도 여기서 다시 검사한다.
 * 좌표·영업시간·주소는 모델에게 받지 않는다. 지어낸 값을 사실로 저장하지 않기 위해서다.
 */

/** 한 번에 담을 수 있는 최대 개수. 모델이 목록을 끝없이 늘리는 경우를 막는다. */
const MAX_ITEMS = 40;
/** 장소 이름의 최대 길이. 넘으면 잘라 담는다. */
const MAX_NAME = 60;

const KIND_BY_LABEL: Readonly<Record<string, StopKind>> = {
  장소: 'place',
  식사: 'meal',
  카페: 'break',
};

export interface AiItem {
  readonly day: number;
  readonly name: string;
  readonly kind: StopKind;
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

  const out: AiItem[] = [];
  // 같은 장소를 두 번 담지 않는다. 앞뒤 공백만 다른 이름도 같은 것으로 본다.
  const seen = new Set<string>();
  for (const entry of raw) {
    if (out.length >= MAX_ITEMS) break;
    const item = entry as { day?: unknown; name?: unknown; kind?: unknown };
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
    });
  }
  return out;
}
