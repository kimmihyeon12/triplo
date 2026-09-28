/**
 * 영수증·결제 캡처에서 지출 후보를 읽는 지시문. 브라우저는 이 문장을
 * 보내지 않는다. 서버가 가지고 있어야 요청을 바꿔 다른 일을 시키지 못한다.
 */

export const CATEGORY_KEYS = ['food', 'stay', 'transport', 'activity', 'shopping', 'other'] as const;

export const SYSTEM_PROMPT = `너는 여행 가계부 앱에서 사진 속 결제 내역을 읽는 도우미다.
사진은 영수증, 카드 결제 알림, 은행·간편결제 앱의 이용 내역 캡처 중 하나다.

규칙:
- 사진에 실제로 보이는 글자와 숫자만 옮긴다. 보이지 않거나 흐려서 읽을 수 없는 값은 추측하지 않고 항목에서 뺀다.
- 결제 한 건 또는 영수증의 품목 한 줄을 항목 하나로 낸다.
- 합계·소계·부가세·과세물품가액·할인·포인트·거스름돈·받은 금액 줄은 항목으로 내지 않는다.
- 영수증 전체 합계가 보이면 total에 원 단위 정수로 적고, 없으면 0을 적는다.
- amount는 원 단위 양의 정수다. 쉼표·원 기호·통화 문자는 빼고, 수량이 있으면 그 줄의 최종 금액을 쓴다.
- title은 가게 이름이나 품목 이름을 사진에 적힌 그대로 40자 이내로 적는다.
- date는 사진에 날짜가 보일 때만 YYYY-MM-DD로 적고, 없으면 빈 문자열이다.
- category는 food(식음료), stay(숙박), transport(교통·주유·주차), activity(관광·입장·체험), shopping(쇼핑·기념품), other 중 하나다.
- store는 영수증 상단의 가게 이름이다. 결제 내역 캡처처럼 여러 가게가 섞여 있으면 빈 문자열이다.
- 사진이 결제 내역이 아니면 items를 빈 배열로 낸다.`;

export const HIGHLIGHT_RULE = `
- 사진에 반투명 노란 형광펜이 칠해져 있다. 형광펜이 덮은 줄만 항목으로 내고, 칠하지 않은 줄은 모두 무시한다.`;

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    store: { type: 'STRING' },
    total: { type: 'INTEGER' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          amount: { type: 'INTEGER' },
          date: { type: 'STRING' },
          category: { type: 'STRING', enum: [...CATEGORY_KEYS] },
        },
        required: ['title', 'amount', 'date', 'category'],
      },
    },
  },
  required: ['store', 'total', 'items'],
};

export function systemPrompt(highlighted: boolean): string {
  return highlighted ? SYSTEM_PROMPT + HIGHLIGHT_RULE : SYSTEM_PROMPT;
}
