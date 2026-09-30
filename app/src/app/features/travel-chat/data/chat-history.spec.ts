import { describe, expect, it } from 'vitest';
import { LocalChatHistory, type KeyValueStorage } from './chat-history';
import type { ChatMessage } from '../model/chat';

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const said = (text: string): ChatMessage =>
  ({ id: text, role: 'user', text, at: '2026-09-30T00:00:00.000Z' }) as ChatMessage;

describe('LocalChatHistory', () => {
  // 같은 기기에서 계정을 바꾸면 이전 계정의 대화가 보이고 다음 모델 요청에도 실렸다(감리 P1-01).
  it('계정마다 다른 열쇠에 저장해 다른 계정의 대화를 읽지 않는다', async () => {
    const storage = memory();
    let account = 'a';
    const history = new LocalChatHistory(storage, () => `tc.chat.${account}`);
    await history.save(null, [said('A의 비밀 여행')]);
    account = 'b';
    expect(await history.load(null)).toEqual([]);
    await history.save(null, [said('B의 대화')]);
    account = 'a';
    expect((await history.load(null)).map((m) => m.text)).toEqual(['A의 비밀 여행']);
  });
});
