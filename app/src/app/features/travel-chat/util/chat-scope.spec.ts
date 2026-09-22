import { describe, expect, it } from 'vitest';
import { classifyQuestion, referenceLinks, isBlankInput } from './chat-scope';

describe('classifyQuestion', () => {
  it('일정 탐색 질문은 explore로 본다', () => {
    expect(classifyQuestion('3일 쉬는데 어디 가지')).toBe('explore');
    expect(classifyQuestion('주말에 갈 만한 곳 추천해줘')).toBe('explore');
  });

  it('영업시간·요금을 묻는 말은 참고 정보로 본다', () => {
    expect(classifyQuestion('불국사 몇 시에 열어')).toBe('reference');
    expect(classifyQuestion('입장료 얼마야')).toBe('reference');
    expect(classifyQuestion('거기 휴무일 언제야')).toBe('reference');
  });

  it('앱이 다루지 않는 예약은 outside로 본다', () => {
    expect(classifyQuestion('항공권 얼마야')).toBe('outside');
    expect(classifyQuestion('렌터카 예약해줘')).toBe('outside');
  });

  it('여행과 무관한 질문은 refusal로 본다', () => {
    expect(classifyQuestion('코드 짜줘')).toBe('refusal');
    expect(classifyQuestion('삼성전자 주가 알려줘')).toBe('refusal');
  });

  it('여행 무관 판정이 앞선다. 여행 낱말이 섞여도 무관한 요청은 막는다', () => {
    expect(classifyQuestion('여행 앱 코드 짜줘')).toBe('refusal');
  });

  it('일정 수정 요청은 explore로 두고 의도 해석은 제공자에게 맡긴다', () => {
    expect(classifyQuestion('3일차 카페 하나 빼줘')).toBe('explore');
  });
});

describe('referenceLinks', () => {
  it('네이버와 카카오 링크를 함께 만든다', () => {
    const links = referenceLinks('불국사', '경주시 진현동');
    expect(links).toHaveLength(2);
    expect(links[0]!.label).toBe('네이버 지도');
    expect(links[1]!.label).toBe('카카오맵');
  });

  it('이름과 주소를 함께 넣어 같은 이름의 다른 장소를 피한다', () => {
    const [naver] = referenceLinks('스타벅스', '강릉시 창해로');
    expect(decodeURIComponent(naver!.url)).toContain('스타벅스 강릉시 창해로');
  });

  it('주소가 없으면 이름만으로 만든다', () => {
    const [naver] = referenceLinks('불국사', '');
    expect(decodeURIComponent(naver!.url)).toContain('불국사');
  });
});

describe('isBlankInput', () => {
  it('공백만 있는 입력은 보내지 않는다', () => {
    expect(isBlankInput('   ')).toBe(true);
    expect(isBlankInput('\n\t')).toBe(true);
    expect(isBlankInput('안녕')).toBe(false);
  });
});
