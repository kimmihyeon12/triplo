/**
 * AI 일정 만들기 프롬프트. 서버에서 만들어 모델에 보낸다.
 * 브라우저가 보내는 것은 사용자가 고른 조건뿐이며 지시문은 서버가 갖는다.
 * 그래야 요청을 바꿔 모델에게 다른 일을 시키지 못한다.
 */

export interface AiPlanInput {
  partySize?: number;
  budget?: number | null;
  budgetBasis?: 'person' | 'group';
  /** 여행 시작일 'YYYY-MM-DD'. 없으면 날짜 미정이다. */
  startDate?: string | null;
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

/**
 * 하루 코스의 기본 구성. 실제로 다닐 수 있는 양이어야 한다. 사용자는 코스에서 뺄 곳만 해제한다.
 * 관광은 2~3곳이라 문장에서 범위로 쓴다.
 */
export const PER_DAY = { meal: 2, cafe: 1, stay: 1 };
/**
 * 일정 밀도별 하루 관광 수. 쇼핑·액티비티도 관광으로 센다(2026-10-01 사용자 결정).
 * 앱은 장소 확인 뒤 최소값(여유롭게 1·보통 2·알차게 3)이 남도록 근처에서 채운다.
 */
export const SIGHTS_BY_PACE: Record<string, string> = { 여유롭게: '1~2곳', 보통: '2~3곳', 알차게: '3~4곳' };

/**
 * 모델이 '해변 산책' 같은 행위 설명을 이름 자리에 넣지 않도록 규칙과 예시를 함께 준다.
 * 이 지시가 없으면 같은 문장을 반복하거나 지역 밖 장소를 넣는 응답이 나온다.
 */
export const SYSTEM_PROMPT = [
  '너는 한국 국내 여행 일정을 짜는 도우미다. 하루하루 실제로 다니는 순서대로 시간순 코스를 짠다.',
  '사용자는 코스에서 원치 않는 곳만 빼고 담는다. 성격이 다른 곳을 고르게 섞어라.',
  '',
  '이름 규칙:',
  '- name에는 반드시 고유명사(지도에서 찾을 수 있는 정식 상호나 명칭)만 적는다.',
  "- '해변 산책', '시장 구경', '카페 투어' 같은 행위 설명은 금지다.",
  "- '○○ 거리', '○○ 골목'처럼 범위가 넓은 이름 대신 그 안의 개별 장소를 적는다.",
  '- 좋은 예: 안목해변, 초당순두부마을, 오죽헌, 테라로사 커피공장',
  '- 나쁜 예: 황리단길(거리), 맛집 탐방(행위), 강릉 카페(불특정)',
  '',
  '분류 규칙(관광·액티비티·식사·카페·쇼핑·기타·숙소 중 하나):',
  "- '관광': 보고 둘러보는 곳(명소·박물관·전망대·공원·해변·유적).",
  "- '액티비티': 직접 타거나 해 보는 곳(체험·레저·케이블카·관광열차·공방).",
  "- '식사': 밥을 먹는 식당만 고른다. 시장이나 거리 전체를 식사로 적지 않는다.",
  "- '카페': 커피·디저트를 파는 실제 가게만 고른다.",
  "- '쇼핑': 물건을 사는 곳(시장·백화점·아울렛·기념품점 같은 개별 매장).",
  "- '숙소': 실제 숙박업소 이름. 하루의 마지막 항목으로 두고, 마지막 날에는 숙소를 넣지 않는다.",
  "- '기타': 위 어디에도 맞지 않는 곳(역·터미널 같은 경유지)에만 쓴다. 기본 구성에는 넣지 않는다.",
  '',
  '코스 규칙:',
  '- order는 그날 방문 순서이며 1부터 매긴다.',
  '- start는 그 장소에 도착하는 추천 시각(HH:mm, 24시간)이다. 식사는 하루 2곳이다. 점심은 12:00~14:00, 저녁은 18:00~20:00 사이에 둔다. 앞 일정 때문에 늦어지는 것은 이 범위 안에서 괜찮다.',
  '- 앞 항목의 start + 체류시간 + 이동시간이 다음 항목의 start를 넘지 않게 한다.',
  '- moveToNext는 다음 항목까지의 이동수단(도보·대중교통·자가용·택시)과 분(minutes)이다. 사용자의 이동수단 조건을 따른다. 그날 마지막 항목은 null.',
  "- 일정 밀도가 '여유롭게'면 하루를 늦게 시작하고 항목을 줄인다. '알차게'면 일찍 시작하고 늘린다.",
  '- 시각과 이동시간은 추천일 뿐이며 확정 시각처럼 쓰지 않는다.',
  '',
  '휴무 규칙:',
  '- 일차별 날짜와 요일을 알려 주면, 그날이 정기휴무일인 곳은 되도록 넣지 않는다.',
  '- closed에는 정기휴무일이 있는 곳만 적는다. note는 "매주 월요일 휴무"처럼 짧게, onDay는 그 일차 날짜가 휴무일이면 true다.',
  '- 상시 영업이거나 휴무일이 없으면 closed=null로 둔다. "명절 외 상시 영업" 같은 영업 안내를 closed에 쓰지 않는다.',
  '- 날짜를 모르면 onDay는 false로 두고 정기휴무만 note에 적는다. 휴무를 모르면 closed=null로 둔다. 추측으로 채우지 않는다.',
  '',
  '선정 규칙:',
  '- 요청한 지역 안에 실제로 있는 장소만 넣는다. 인접 도시의 장소를 넣지 않는다.',
  '- 꼭 갈 장소는 요청 지역 밖이어도 반드시 코스에 넣는다. 이름이 틀렸으면 지도에서 찾을 수 있는 정식 상호로 바로잡아 적는다.',
  '- 같은 장소를 두 번 넣지 않는다.',
  '- 유명한 곳만 나열하지 말고 성격이 다른 곳을 섞는다.',
  '- 하루 안에서는 서로 가까운 장소끼리 묶는다.',
  '- 영업시간, 좌표, 전화번호는 쓰지 않는다. 그런 정보는 우리가 따로 확인한다.',
  '',
  '예상 비용과 체류시간:',
  '- estimate.cost에 원화 단가 범위 min/max, 기준 basis(person=1인당 1회, group=일행 전체 1회, room_night=객실당 1박), 수량 quantity, 계산 가정 assumption을 적는다.',
  '- person의 quantity는 1인당 이용 횟수다. 인원은 서버/앱에서 별도로 곱하므로 중복 반영하지 않는다. room_night의 quantity는 객실 수×박 수다.',
  '- 요금의 출처를 조회할 도구가 없다. 금액은 AI 예상일 뿐이며 공식·확인됨·최신이라는 표현이나 출처 URL을 만들지 않는다. 추정이 어려우면 cost=null로 둔다. 미정을 0원으로 채우지 않는다.',
  "- 입장료가 없는 곳은 cost를 min=0, max=0, basis='group', quantity=1, assumption='입장 무료'로 적는다. 해변·공원·마을처럼 무료인 곳을 null로 두지 않는다.",
  '- assumption에는 성인 일반 입장권 1장, 아메리카노 1잔, 피자 S 1판 등 포함 상품과 수량의 계산 가정을 적는다. 할인·아동요금은 인원 구성을 모르므로 단정하지 않는다.',
  '- estimate.stay에는 추천 체류시간 범위(분) min/max와 여행 속도에 맞춘 이유 reason을 적는다. 알 수 없으면 null로 둔다. 이동시간은 포함하지 않는다.',
  '- 숙소의 cost는 room_night 기준으로 1박 요금을 적는다.',
  '- 예산은 여행 전체 기준이며 숙소 비용을 포함한다. 이동 교통비에 쓸 여유를 남긴다.',
  '- 예산이 있으면 숙소·식당은 예산 수준에 맞는 곳을 고른다. 예산 대비 비싼 고급 호텔·코스 요리를 넣지 않는다.',
  '- 고른 곳의 요금은 사실대로 추정한다. 예산에 맞추려고 단가를 낮춰 적거나 예산 내라고 보장하지 않는다.',
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
          estimate: { type: 'object', properties: {
            cost: { type: 'object', nullable: true, properties: {
              min: { type: 'integer' }, max: { type: 'integer' },
              basis: { type: 'string', enum: ['person', 'group', 'room_night'] },
              quantity: { type: 'integer' }, assumption: { type: 'string' },
            }, required: ['min', 'max', 'basis', 'quantity', 'assumption'] },
            stay: { type: 'object', nullable: true, properties: {
              min: { type: 'integer' }, max: { type: 'integer' }, reason: { type: 'string' },
            }, required: ['min', 'max', 'reason'] },
          }, required: ['cost', 'stay'] },
          day: { type: 'integer' },
          order: { type: 'integer' },
          name: { type: 'string' },
          kind: { type: 'string', enum: ['관광', '액티비티', '식사', '카페', '쇼핑', '기타', '숙소'] },
          start: { type: 'string', nullable: true },
          // 휴무를 모르면 null이다. 모든 장소에 필요하지 않으므로 required에 넣지 않는다.
          closed: { type: 'object', nullable: true, properties: {
            onDay: { type: 'boolean' }, note: { type: 'string' },
          }, required: ['onDay', 'note'] },
          // 그날 마지막 항목은 이동이 없으므로 required에 넣지 않는다.
          moveToNext: { type: 'object', nullable: true, properties: {
            mode: { type: 'string', enum: ['도보', '대중교통', '자가용', '택시'] },
            minutes: { type: 'integer' },
          }, required: ['mode', 'minutes'] },
        },
        required: ['day', 'order', 'name', 'kind', 'start', 'estimate'],
      },
    },
  },
  required: ['items'],
};

/**
 * 요청이 장소의 종류·개수·범위를 직접 정하는지 본다. 그렇다면 기본 구성을
 * 빼야 한다. '롯데월드 안 맛집만'이라고 적었는데 '관광 2~3곳'을 함께 보내면
 * 모델이 그 숫자까지 채우려고 관계없는 장소를 넣는다.
 */
export function noteSetsScope(note: string): boolean {
  // 무엇을 넣거나 뺄지 못박는 말, 그리고 숫자가 붙은 개수 표현만 본다.
  // '사진 찍기 좋은 곳'처럼 취향을 적은 문장까지 범위 지정으로 보면
  // 기본 구성이 사라져 결과가 너무 적어진다.
  return /만\s|만$|말고|빼|제외|없이|위주|중심|\d+\s*(개|곳|끼|군데)/.test(note);
}

/**
 * 요청이 하루 중 시간대를 정하는지 본다('저녁 이후', '오후부터', '밤에만', '3시 이후').
 * 그렇다면 그 시간대만 짜야 한다. 하루 기본 구성과 식사 2곳을 함께 보내면 모델이
 * 점심·관광까지 채운다(2026-10-01 '저녁 이후 계획'에 하루 전체가 나온 것을 확인).
 * '저녁은 해산물'처럼 끼니 취향을 적은 말은 시간대 지정이 아니다.
 */
export function noteSetsTime(note: string): boolean {
  return /(아침|오전|점심|오후|저녁|밤)\s*(이후|부터|에만|만)|야간|\d{1,2}\s*시\s*(이후|부터|까지|전)/.test(note);
}

/** 한 칸에 담는 글자 수 상한. 길게 보내도 결과가 나아지지 않고 토큰만 쓴다. */
const MAX_FIELD = 200;

function clip(text: string): string {
  return text.trim().slice(0, MAX_FIELD);
}

export function buildUserPrompt(r: AiPlanInput): string {
  const note = clip(r.extraNote);
  const timed = note !== '' && noteSetsTime(note);
  const scoped = note !== '' && (noteSetsScope(note) || timed);
  const lines: string[] = [];

  // 사용자가 직접 적은 요청을 맨 앞에 둔다. 뒤에 붙이면 기본 구성에 눌린다.
  if (note) {
    lines.push(
      timed ? '가장 중요한 요청이다. 이것을 먼저 지켜라:' : '가장 중요한 요청이다. 아래 식사 규칙을 지키는 선에서 이것을 먼저 지켜라:',
      `「${note}」`,
      '',
    );
    if (timed)
      lines.push('이 요청이 시간대를 정했다. 그 시간대 안의 일정만 짠다. 식사도 그 시간대에 드는 것만 넣는다.', '');
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
  if (r.startDate) lines.push(`일차별 날짜: ${dayDates(r.startDate, r.dayCount)}`);
  const people = r.partySize ?? 1;
  lines.push(`여행 인원: ${people}명`);
  lines.push(r.budget == null ? '여행 예산: 미정' : `여행 전체 기간 예산: ${r.budget}원 (${r.budgetBasis === 'person' ? '1인 기준' : '전체 인원 기준'}), 전체 인원 총예산 ${r.budget * (r.budgetBasis === 'person' ? people : 1)}원`);
  if (clip(r.taste)) lines.push(`취향: ${clip(r.taste)}`);
  if (clip(r.mustGo)) lines.push(`꼭 갈 장소(반드시 포함): ${clip(r.mustGo)}`);
  if (clip(r.bookedStay)) lines.push(`이미 정한 숙소: ${clip(r.bookedStay)}`);

  const dayTrip = r.dayCount === 1;
  // 요청이 범위를 정했으면 기본 개수를 아예 적지 않는다.
  if (!scoped)
    lines.push(
      '',
      `${note ? '위 요청에 어긋나지 않는 선에서, ' : ''}하루에 관광·액티비티·쇼핑을 합쳐 ${SIGHTS_BY_PACE[r.pace] ?? SIGHTS_BY_PACE['보통']},` +
        ` 식사 ${PER_DAY.meal}곳(점심·저녁), 카페 ${PER_DAY.cafe}곳을 코스로 짜` +
        (dayTrip ? '줘.' : `고 마지막 날을 뺀 날마다 숙소 ${PER_DAY.stay}곳을 그날 마지막에 넣어 줘.`),
    );
  // 식사는 추가 요청과 상관없이 늘 넣는다. 카페 위주 요청에 점심·저녁이 사라진 적이 있다(2026-09-30).
  if (!timed)
    lines.push('하루 식사 2곳(점심 12시쯤, 저녁 18시쯤)은 추가 요청과 관계없이 반드시 넣는다. 앞 일정 때문에 1~2시간 늦어지는 것은 괜찮다.');
  // 사용자가 고른 식당은 더하지 않고 대신한다. 아침은 요청했을 때만 더한다(2026-10-01 사용자 결정).
  lines.push('사용자가 이름을 적은 식당은 점심이나 저녁 한 자리를 대신한다. 그날 식사를 3곳으로 늘리지 않는다. 아침을 요청했으면 아침(8~9시) 식사도 넣는다.');
  // 당일치기는 요청 범위와 상관없이 숙소를 넣지 않는다(2026-09-30 당일치기에 숙소가 나온 것을 확인).
  if (dayTrip) lines.push('당일치기라 숙소는 넣지 않는다.');

  return lines.join('\n');
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** '1일차 2026-10-01(목), 2일차 2026-10-02(금)'. 모델이 요일별 휴무를 따질 수 있게 한다. */
function dayDates(startDate: string, dayCount: number): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return `${i + 1}일차 ${d.toISOString().slice(0, 10)}(${WEEKDAY[d.getUTCDay()]})`;
  }).join(', ');
}
