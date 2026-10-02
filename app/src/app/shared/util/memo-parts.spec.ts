import { describe, expect, it } from 'vitest';
import { memoParts } from './memo-parts';

describe('memoParts', () => {
  it('AI 추정 목록과 사용자가 덧붙인 글을 나눈다', () => {
    expect(memoParts(['AI 추정', '- 시각 10:00', '- 체류 60~90분', '주차는 뒤편'].join('\n'))).toEqual({
      estimate: ['- 시각 10:00', '- 체류 60~90분'],
      note: '주차는 뒤편',
    });
  });

  it('값과 괄호 설명이 같으면 괄호를 뺀다', () => {
    expect(memoParts(['AI 추정', '- 요금 무료 (무료)'].join('\n')).estimate).toEqual(['- 요금 무료']);
    expect(memoParts(['AI 추정', '- 요금 6,000원 (2명 · 입장권)'].join('\n')).estimate).toEqual([
      '- 요금 6,000원 (2명 · 입장권)',
    ]);
  });

  it('AI 추정으로 시작하지 않으면 전부 사용자 글이다', () => {
    expect(memoParts('- 내가 쓴 목록')).toEqual({ estimate: [], note: '- 내가 쓴 목록' });
    expect(memoParts(null)).toEqual({ estimate: [], note: '' });
  });
});
