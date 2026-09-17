/**
 * AI 일정 만들기 프롬프트. 서버에서 만들어 모델에 보낸다.
 * 브라우저가 보내는 것은 사용자가 고른 조건뿐이며 지시문은 서버가 갖는다.
 * 그래야 요청을 바꿔 모델에게 다른 일을 시키지 못한다.
 */

export interface AiPlanInput {
  regions: string[];
  dayCount: number;
  companion: string;
  transport: string;
  pace: string;
  taste: string;
  mustGo: string;
  bookedStay: string;
  extraNote: string;
}

/** 하루에 받을 후보 수. 사용자가 골라 담으므로 넉넉히 받는다. */
export const PER_DAY = { place: 5, meal: 3, cafe: 2 };
const PER_DAY_TOTAL = PER_DAY.place + PER_DAY.meal + PER_DAY.cafe;

/**
 * 모델이 '해변 산책' 같은 행위 설명을 이름 자리에 넣지 않도록 규칙과 예시를 함께 준다.
 * 이 지시가 없으면 같은 문장을 반복하거나 지역 밖 장소를 넣는 응답이 나온다.
 */
export const SYSTEM_PROMPT = [
  '너는 한국 국내 여행 일정을 짜는 도우미다. 사용자는 네가 고른 후보 중에서',
  '마음에 드는 것만 골라 담는다. 그러니 후보를 넉넉하고 다양하게 내라.',
  '',
  '이름 규칙:',
  '- name에는 반드시 고유명사(지도에서 찾을 수 있는 정식 상호나 명칭)만 적는다.',
  "- '해변 산책', '시장 구경', '카페 투어' 같은 행위 설명은 금지다.",
  "- '○○ 거리', '○○ 골목'처럼 범위가 넓은 이름 대신 그 안의 개별 장소를 적는다.",
  '- 좋은 예: 안목해변, 초당순두부마을, 오죽헌, 테라로사 커피공장',
  '- 나쁜 예: 황리단길(거리), 맛집 탐방(행위), 강릉 카페(불특정)',
  '',
  '분류 규칙:',
  "- '식사'는 밥을 먹는 식당만 고른다. 시장이나 거리 전체를 식사로 적지 않는다.",
  "- '카페'는 커피·디저트를 파는 실제 가게만 고른다.",
  "- 나머지는 모두 '장소'다.",
  '',
  '선정 규칙:',
  '- 요청한 지역 안에 실제로 있는 장소만 넣는다. 인접 도시의 장소를 넣지 않는다.',
  '- 같은 장소를 두 번 넣지 않는다.',
  '- 유명한 곳만 나열하지 말고 성격이 다른 곳을 섞는다.',
  '- 하루 안에서는 서로 가까운 장소끼리 묶는다.',
  '- 영업시간, 좌표, 가격, 전화번호는 쓰지 않는다. 그런 정보는 우리가 따로 확인한다.',
].join('\n');

/** 응답 구조를 고정한다. Gemini는 `additionalProperties`를 모르므로 넣지 않는다. */
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer' },
          name: { type: 'string' },
          kind: { type: 'string', enum: ['장소', '식사', '카페'] },
        },
        required: ['day', 'name', 'kind'],
      },
    },
  },
  required: ['items'],
};

/**
 * 요청이 장소의 종류·개수·범위를 직접 정하는지 본다. 그렇다면 기본 구성을
 * 빼야 한다. '롯데월드 안 맛집만'이라고 적었는데 '장소 5곳'을 함께 보내면
 * 모델이 그 숫자까지 채우려고 관계없는 장소를 넣는다.
 */
export function noteSetsScope(note: string): boolean {
  // 무엇을 넣거나 뺄지 못박는 말, 그리고 숫자가 붙은 개수 표현만 본다.
  // '사진 찍기 좋은 곳'처럼 취향을 적은 문장까지 범위 지정으로 보면
  // 기본 구성이 사라져 결과가 너무 적어진다.
  return /만\s|만$|말고|빼|제외|없이|위주|중심|\d+\s*(개|곳|끼|군데)/.test(note);
}

/** 한 칸에 담는 글자 수 상한. 길게 보내도 결과가 나아지지 않고 토큰만 쓴다. */
const MAX_FIELD = 200;

function clip(text: string): string {
  return text.trim().slice(0, MAX_FIELD);
}

export function buildUserPrompt(r: AiPlanInput): string {
  const note = clip(r.extraNote);
  const scoped = note !== '' && noteSetsScope(note);
  const lines: string[] = [];

  // 사용자가 직접 적은 요청을 맨 앞에 둔다. 뒤에 붙이면 기본 구성에 눌린다.
  if (note) {
    lines.push('가장 중요한 요청이다. 다른 어떤 지시보다 이것을 먼저 지켜라:', `「${note}」`, '');
    if (scoped)
      lines.push(
        '이 요청이 장소의 종류·개수·범위를 정했다. 요청에 없는 종류의 장소는 넣지 마라.',
        '개수도 요청에 맞춘다. 목록을 억지로 늘리지 않는다.',
        '',
      );
  }

  lines.push(
    `${r.regions.map(clip).join(', ')} ${r.dayCount}일 여행 일정을 짜 줘.`,
    `동행: ${clip(r.companion)}`,
    `이동수단: ${clip(r.transport)}`,
    `일정 밀도: ${clip(r.pace)}`,
  );
  if (clip(r.taste)) lines.push(`취향: ${clip(r.taste)}`);
  if (clip(r.mustGo)) lines.push(`꼭 갈 장소: ${clip(r.mustGo)}`);
  if (clip(r.bookedStay)) lines.push(`이미 정한 숙소: ${clip(r.bookedStay)}`);

  // 요청이 범위를 정했으면 기본 개수를 아예 적지 않는다.
  if (!scoped)
    lines.push(
      '',
      `${note ? '위 요청에 어긋나지 않는 선에서, ' : ''}하루에 장소 ${PER_DAY.place}곳,` +
        ` 식사 ${PER_DAY.meal}곳, 카페 ${PER_DAY.cafe}곳씩 골라` +
        ` 모두 ${r.dayCount * PER_DAY_TOTAL}곳을 추천해 줘.`,
    );

  return lines.join('\n');
}
