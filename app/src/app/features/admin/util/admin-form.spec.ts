import { describe, expect, it } from 'vitest';
import { noticeFormError, replyFormError } from './admin-form';

describe('관리자 폼 검사', () => {
  it('공지 제목·본문이 비었거나 길면 저장을 막는다', () => {
    expect(noticeFormError('   ', '본문')).toBe('제목을 입력해 주세요.');
    expect(noticeFormError('제목', '  ')).toBe('본문을 입력해 주세요.');
    expect(noticeFormError('가'.repeat(101), '본문')).toBe('제목은 100자까지 쓸 수 있어요.');
    expect(noticeFormError('제목', '가'.repeat(5001))).toBe('본문은 5000자까지 쓸 수 있어요.');
    expect(noticeFormError(' 제목 ', ' 본문 ')).toBeNull();
  });
  it('답변이 비었거나 길면 막는다', () => {
    expect(replyFormError('  ')).toBe('답변을 입력해 주세요.');
    expect(replyFormError('가'.repeat(2001))).toBe('답변은 2000자까지 쓸 수 있어요.');
    expect(replyFormError('확인했어요')).toBeNull();
  });
});
