import type { ChatReplyKind, ReferenceLink } from '../model/chat';

/**
 * 질문의 갈래를 앱에서 먼저 나눈다.
 *
 * 지시문만으로 범위를 막지 않는 이유는 모델이 지시를 어길 수 있기 때문이다.
 * 여기서 한 번 거르고 서버에서 응답을 다시 검사한다(13-B). 확실히 벗어난
 * 질문은 모델을 부르지 않으므로 무료 한도도 아낀다.
 *
 * 애매하면 explore로 둔다. 잘못 막으면 사용자가 할 수 있는 일이 줄어들지만,
 * 잘못 통과시키면 다음 단계인 서버 검사가 다시 걸러낸다.
 */

/** 영업정보를 묻는 말. 확인되지 않은 답이므로 구분 표시와 함께 보여준다. */
const REFERENCE_WORDS = [
  '몇 시',
  '몇시',
  '영업시간',
  '영업 시간',
  '운영시간',
  '운영 시간',
  '여는 시간',
  '문 여',
  '문 닫',
  '휴무',
  '쉬는 날',
  '휴관',
  '입장료',
  '요금',
  '얼마',
  '가격',
  '주차',
];

/** 여행이지만 이 앱이 다루지 않는 일. 거절로 끝내지 않고 일정으로 유도한다. */
const OUTSIDE_WORDS = [
  '항공권',
  '비행기표',
  '비행기 표',
  '렌터카',
  '기차표',
  '기차 표',
  'ktx 예매',
  '숙소 예약',
  '호텔 예약',
  '예매',
  '환전',
  '비자',
  '여권',
];

/** 여행과 아무 관계가 없는 요청. 정해진 안내를 돌려준다. */
const UNRELATED_WORDS = [
  '코드',
  '프로그램',
  '개발',
  '주가',
  '주식',
  '코인',
  '번역',
  '숙제',
  '레시피',
  '운세',
  '로또',
];

function hasWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

/**
 * 질문을 갈래로 나눈다. 'draft'는 모델이 실제로 장소를 내놓았을 때만 붙으므로
 * 여기서는 만들지 않는다.
 *
 * 무관한 요청을 가장 먼저 본다. '여행 앱 코드 짜줘'처럼 여행 낱말이 섞여도
 * 하려는 일은 여행이 아니기 때문이다.
 */
export function classifyQuestion(input: string): Exclude<ChatReplyKind, 'draft'> {
  const text = input.trim().toLowerCase();
  if (!text) return 'refusal';
  if (hasWord(text, UNRELATED_WORDS)) return 'refusal';
  if (hasWord(text, OUTSIDE_WORDS)) return 'outside';
  if (hasWord(text, REFERENCE_WORDS)) return 'reference';
  return 'explore';
}

/**
 * 참고 정보를 확인할 수 있는 링크. 두 곳을 함께 주는 이유는 서로 채워진
 * 정보가 다르기 때문이다. 네이버는 국내 장소의 영업정보가 더 잘 들어가 있고,
 * 카카오는 우리가 검색에 쓰는 곳이라 같은 장소를 찾기 쉽다.
 *
 * 주소를 이름과 함께 넣어 같은 상호의 다른 지점으로 가지 않게 한다. 네이버는
 * 장소 ID를 주지 않으므로 어느 쪽이든 검색 주소를 만든다.
 */
export function referenceLinks(name: string, address: string): readonly ReferenceLink[] {
  const query = encodeURIComponent([name.trim(), address.trim()].filter(Boolean).join(' '));
  return [
    { label: '네이버 지도', url: `https://map.naver.com/p/search/${query}` },
    { label: '카카오맵', url: `https://map.kakao.com/?q=${query}` },
  ];
}

/** 보낼 내용이 없는 입력. 공백만 눌러 호출 횟수를 쓰지 않게 한다. */
export function isBlankInput(input: string): boolean {
  return input.trim().length === 0;
}
