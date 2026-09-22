import { InjectionToken } from '@angular/core';
import type { ChatMessage } from '../model/chat';

/**
 * 대화 기록 저장소. 화면은 이 인터페이스만 쓴다.
 *
 * 지금은 기기에만 저장하고 서버로 보내지 않는다. 사진·여행 기록을 기본
 * 비공개로 두는 것과 같은 기준이다. 13-B에서 서버 구현으로 갈아 끼울 때
 * 화면 코드는 고치지 않는다.
 *
 * 대화는 여행마다 따로 보관한다. 여행 목록에서 연 대화는 아직 대상 여행이
 * 없으므로 `null` 열쇠를 쓴다.
 */
export interface ChatHistoryStore {
  load(tripId: string | null): Promise<readonly ChatMessage[]>;
  save(tripId: string | null, messages: readonly ChatMessage[]): Promise<void>;
  clear(tripId: string | null): Promise<void>;
}

export const CHAT_HISTORY = new InjectionToken<ChatHistoryStore>('CHAT_HISTORY');

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface HistoryFile {
  readonly version: 1;
  readonly threads: Record<string, unknown>;
}

/**
 * 한 대화에 남기는 최대 줄 수. 넘으면 오래된 것부터 버린다.
 * 기기 저장 공간은 한정되어 있고, 오래된 대화를 다시 읽는 일은 드물다.
 */
const MAX_MESSAGES = 200;

/** 여행 목록에서 연 대화가 쓰는 열쇠. */
const LIST_KEY = '__list__';

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['id'] === 'string' &&
    (m['role'] === 'user' || m['role'] === 'assistant' || m['role'] === 'system') &&
    typeof m['text'] === 'string' &&
    typeof m['at'] === 'string'
  );
}

/**
 * 같은 기기에만 남기는 대화 저장소.
 *
 * 읽다가 형식이 깨진 줄을 만나면 그 줄만 버리고 나머지를 살린다. 대화 전체를
 * 잃는 것보다 낫고, 저장 형식이 바뀌어도 앞선 기록이 화면을 막지 않는다.
 */
export class LocalChatHistory implements ChatHistoryStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
  ) {}

  private read(): Record<string, ChatMessage[]> {
    const raw = this.storage.getItem(this.key);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as HistoryFile;
      if (!parsed || typeof parsed.threads !== 'object' || parsed.threads === null) return {};
      const out: Record<string, ChatMessage[]> = {};
      for (const [id, value] of Object.entries(parsed.threads)) {
        if (Array.isArray(value)) out[id] = value.filter(isMessage);
      }
      return out;
    } catch {
      // 읽을 수 없는 기록이 대화 시작을 막지 않게 한다.
      return {};
    }
  }

  private write(threads: Record<string, ChatMessage[]>): void {
    const file: HistoryFile = { version: 1, threads };
    try {
      this.storage.setItem(this.key, JSON.stringify(file));
    } catch {
      // 저장 공간이 차도 대화는 이어질 수 있어야 한다. 화면 상태가 원본이다.
    }
  }

  async load(tripId: string | null): Promise<readonly ChatMessage[]> {
    return this.read()[tripId ?? LIST_KEY] ?? [];
  }

  async save(tripId: string | null, messages: readonly ChatMessage[]): Promise<void> {
    const threads = this.read();
    threads[tripId ?? LIST_KEY] = messages.slice(-MAX_MESSAGES);
    this.write(threads);
  }

  async clear(tripId: string | null): Promise<void> {
    const threads = this.read();
    delete threads[tripId ?? LIST_KEY];
    this.write(threads);
  }
}
