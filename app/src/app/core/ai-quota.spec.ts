import { describe, expect, it } from 'vitest';
import { AiQuota, aiLimitMessage } from './ai-quota';
import { FunctionError } from '../features/auth/data/function-error';

describe('aiLimitMessage', () => {
  it('내 한도는 서버가 알려 준 한도로 문장을 만든다', () => {
    expect(aiLimitMessage('plan', new FunctionError('user_limit', { error: 'user_limit', limit: 7 }))).toBe(
      '오늘 AI 일정 만들기를 7번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
    expect(aiLimitMessage('chat', new FunctionError('user_limit', { limit: 30 }))).toBe(
      '오늘 챗봇 질문을 30번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
  });

  it('앱 전체 무료 한도는 초기화 시각을 알린다', () => {
    expect(aiLimitMessage('plan', new Error('quota_exceeded'))).toBe(
      '오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요.',
    );
    expect(aiLimitMessage('receipt', new Error('quota_exceeded'))).toBe(
      '오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요. 지금은 직접 입력해 주세요.',
    );
  });

  it('한도와 관계없는 오류는 null', () => {
    expect(aiLimitMessage('plan', new Error('invalid_request'))).toBeNull();
  });
});

describe('AiQuota', () => {
  it('남은 횟수가 3 이하일 때만 안내를 만든다', () => {
    const quota = new AiQuota();
    const hint = quota.hint('receipt');
    expect(hint()).toBeNull();
    quota.record('receipt', 4);
    expect(hint()).toBeNull();
    quota.record('receipt', 3);
    expect(hint()).toBe('오늘 3번 남음');
    quota.record('receipt', 'x');
    expect(hint()).toBe('오늘 3번 남음');
  });
});
