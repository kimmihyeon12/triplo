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

/** 랜덤 여행지를 뽑은 뒤에도 테마를 골라 탐색한다. */
export function regionChips(region: string): readonly string[] {
  return [
    '다시 뽑아줘',
    `${region}에서 먹방 코스 추천해줘`,
    `${region}에서 카페 투어 코스 추천해줘`,
    `${region}에서 사진 찍기 좋은 코스 추천해줘`,
    `${region}에서 느긋한 하루 코스 추천해줘`,
  ];
}

/** 저장된 대화의 옛 탐색 예시만 교체하고 날짜·장소 확인 선택지는 보존한다. */
export function refreshChips(chips: readonly string[]): readonly string[] {
  const replacements: Record<string, string> = {
    '속초는 어때': '속초에서 먹방 코스 추천해줘',
    '바다 쪽으로 보고 싶어': '바다 보며 멍때리는 코스 추천해줘',
    '다른 지역도 볼래': '여행지 랜덤으로 뽑아줘',
    '다른 곳도 알려줘': '숨은 여행 명소 추천해줘',
    '근처에 뭐가 있어': '근처에서 사진 찍기 좋은 곳 추천해줘',
    '다른 곳으로 바꿔줘': '이 코스를 먹방 여행으로 바꿔줘',
    '카페도 넣어줘': '이 코스에 디저트 카페도 넣어줘',
  };
  return [...new Set(chips.map((chip) => {
    const legacy = /^(.+?)(?:으로)? (?:일정 짜줘|뭐가 있어)$/.exec(chip);
    return legacy ? `${legacy[1]}에서 먹방 코스 추천해줘` : replacements[chip] ?? chip;
  }))].slice(0, MAX_CHIPS);
}

/** 여행 목록에서 열었을 때. 아직 대상 여행이 없어 어디로 갈지부터 묻는다. */
export function listChips(): readonly string[] {
  return [
    '여행지 랜덤으로 뽑아줘',
    '먹방 여행 코스 추천해줘',
    '카페 투어 코스 추천해줘',
    '사진 찍기 좋은 여행 코스 추천해줘',
    '느긋한 당일치기 코스 추천해줘',
  ];
}

/**
 * 여행 상세에서도 가볍게 탐색하는 질문을 권한다.
 * 저장된 첫 지역을 포함해 현재 여행과 연결한다.
 */
export function tripChips(trip: Trip): readonly string[] {
  const region = trip.regions[0]?.name;
  const prefix = region ? `${region}에서 ` : '';
  return [
    '여행지 랜덤으로 뽑아줘',
    `${prefix}먹방 코스 추천해줘`,
    `${prefix}카페 투어 코스 추천해줘`,
    `${prefix}사진 찍기 좋은 코스 추천해줘`,
    `${prefix}느긋한 하루 코스 추천해줘`,
  ].slice(0, MAX_CHIPS);
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
