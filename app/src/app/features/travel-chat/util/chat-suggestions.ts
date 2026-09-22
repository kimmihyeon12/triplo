import { KOREA_REGIONS, type KoreaRegion } from '../../../shared/util/korea-regions';
import type { Trip } from '../../trips/model/trip';

/**
 * 빈 대화 화면에 보여줄 추천 질문과 랜덤 여행지 뽑기.
 *
 * 칩을 두는 이유는 빈 입력창 앞에서 무엇을 물어야 할지 모르는 상태를 없애기
 * 위해서다. 무엇을 할 수 있는 곳인지 예시로 알린다.
 */

/** 한 번에 보여줄 칩의 최대 개수. 더 늘리면 줄바꿈이 길어져 입력창이 밀린다. */
const MAX_CHIPS = 6;

/** 하루에 이보다 많으면 빡빡한 일정으로 본다. 이동 시간을 빼고도 빠듯한 수다. */
const CROWDED_DAY = 5;

/** 여행 목록에서 열었을 때. 아직 대상 여행이 없어 어디로 갈지부터 묻는다. */
export function listChips(): readonly string[] {
  return [
    '이번 주말 근교 어디 갈까',
    '혼자 가기 좋은 소도시 알려줘',
    '아이와 갈 만한 곳 추천해줘',
    '2박 3일로 다녀올 만한 곳',
    '아무 데나 뽑아줘',
  ];
}

/**
 * 여행 상세에서 열었을 때. 그 여행의 상태를 보고 지금 할 만한 일을 고른다.
 * 장소가 하나도 없는 여행에 '순서 정리하기'를 권하면 눌러도 할 일이 없다.
 */
export function tripChips(trip: Trip): readonly string[] {
  const chips: string[] = [];
  const active = trip.stops.filter((s) => !s.excluded);

  if (active.length === 0) {
    chips.push('일정을 채워줘', '가 볼 만한 곳 알려줘', '맛집 추천해줘', '카페 한 곳 넣어줘');
    return chips.slice(0, MAX_CHIPS);
  }

  if (active.some((s) => s.date === null)) chips.push('남은 장소를 날짜에 배치해줘');

  const perDay = new Map<string, number>();
  for (const stop of active) {
    if (!stop.date) continue;
    perDay.set(stop.date, (perDay.get(stop.date) ?? 0) + 1);
  }
  if ([...perDay.values()].some((count) => count >= CROWDED_DAY)) chips.push('이 날 너무 빡빡해');

  chips.push('동선에 맞게 순서 정리해줘', '근처 맛집 추가해줘', '카페 한 곳 넣어줘');
  return chips.slice(0, MAX_CHIPS);
}

/**
 * 갈 곳을 하나 뽑는다. 모델에게 자유 생성을 맡기지 않고 앱이 먼저 고른다.
 * 모델이 지명을 지어내면 검색에서 아무것도 찾지 못해 담을 수 없는 결과가
 * 되는데, 고정 목록에서 뽑으면 그런 일이 구조적으로 생기지 않는다.
 *
 * `recentCodes`에 있는 지역은 뺀다. 같은 곳이 연달아 나오면 뽑기를 다시 눌러도
 * 달라지는 것이 없어 기능이 고장 난 것처럼 보인다. 남는 것이 없을 만큼 많이
 * 뽑았으면 제한을 풀어 하나라도 돌려준다.
 *
 * `random`을 받는 이유는 테스트에서 결과를 정해 두기 위해서다.
 */
export function pickRandomRegion(
  recentCodes: readonly string[],
  random: () => number = Math.random,
): KoreaRegion | null {
  const recent = new Set(recentCodes);
  const pool = KOREA_REGIONS.filter((r) => !recent.has(r.code));
  const from = pool.length > 0 ? pool : KOREA_REGIONS;
  if (from.length === 0) return null;
  const index = Math.min(from.length - 1, Math.max(0, Math.floor(random() * from.length)));
  return from[index] ?? null;
}
