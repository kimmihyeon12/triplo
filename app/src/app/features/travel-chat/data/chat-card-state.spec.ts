import { describe, expect, it } from 'vitest';
import { ChatCardState } from './chat-card-state';

describe('ChatCardState', () => {
  it('적용한 카드와 닫은 카드를 기억하고 새 대화에서 비운다', () => {
    const cards = new ChatCardState();
    cards.markApplied('m1');
    cards.dismiss('m2');
    cards.dismiss('m3');
    expect(cards.appliedMessageId()).toBe('m1');
    expect(cards.dismissedIds()).toEqual(['m2', 'm3']);
    cards.clearApplied();
    expect(cards.appliedMessageId()).toBeNull();
    cards.markApplied('m4');
    cards.reset();
    expect(cards.appliedMessageId()).toBeNull();
    expect(cards.dismissedIds()).toEqual([]);
  });

  it('화면마다 따로 만들어 서로 섞이지 않는다', () => {
    const page = new ChatCardState();
    const sheet = new ChatCardState();
    page.markApplied('m1');
    expect(sheet.appliedMessageId()).toBeNull();
  });
});
