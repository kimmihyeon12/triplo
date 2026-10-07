import { InjectionToken } from '@angular/core';
import type { ChatMessage } from '../model/chat';

/**
 * 대화 기록 저장소. 화면은 이 인터페이스만 쓴다.
 *
 * 운영 빌드는 서버 구현(`SupabaseChatHistory`, 본인만 읽음), 테스트 빌드와
 * 미리보기는 이 파일의 기기 구현을 쓴다. 화면 코드는 어느 쪽인지 모른다.
 *
 * 대화는 여행마다 따로 보관한다. 여행 목록에서 연 대화는 아직 대상 여행이
 * 없으므로 `null` 열쇠를 쓴다.
 */
export interface ChatHistoryStore {
  load(tripId: string | null): Promise<readonly ChatMessage[]>;
  /** 새 줄만 받는다. 화면 상태가 원본이다. */
  append(tripId: string | null, message: ChatMessage): Promise<void>;
  clear(tripId: string | null): Promise<void>;
}

/** 기기에 남은 대화 묶음. 서버로 옮길 때 쓴다. 열쇠는 여행 id, 목록 대화는 '__list__'. */
export interface DeviceChatThreads {
  exportThreads(): Record<string, readonly ChatMessage[]>;
  forget(): void;
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
export class LocalChatHistory implements ChatHistoryStore, DeviceChatThreads {
  /**
   * 열쇠는 계정마다 달라야 한다. 함수로 받으면 읽고 쓸 때마다 지금 계정의 열쇠를 쓴다.
   * 하나의 열쇠를 쓰면 같은 기기에서 계정을 바꿨을 때 이전 계정의 대화가 보이고
   * 다음 모델 요청에도 실렸다(2026-09-30 감리 P1-01).
   */
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string | (() => string),
  ) {}

  private get storageKey(): string {
    return typeof this.key === 'function' ? this.key() : this.key;
  }

  private read(): Record<string, ChatMessage[]> {
    const raw = this.storage.getItem(this.storageKey);
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
      this.storage.setItem(this.storageKey, JSON.stringify(file));
    } catch {
      // 저장 공간이 차도 대화는 이어질 수 있어야 한다. 화면 상태가 원본이다.
    }
  }

  async load(tripId: string | null): Promise<readonly ChatMessage[]> {
    return this.read()[tripId ?? LIST_KEY] ?? [];
  }

  async append(tripId: string | null, message: ChatMessage): Promise<void> {
    const threads = this.read();
    const key = tripId ?? LIST_KEY;
    threads[key] = [...(threads[key] ?? []), message].slice(-MAX_MESSAGES);
    this.write(threads);
  }

  exportThreads(): Record<string, readonly ChatMessage[]> {
    return this.read();
  }

  forget(): void {
    try {
      this.storage.removeItem(this.storageKey);
    } catch {
      // 저장소 접근이 막혀도 대화는 이어진다.
    }
  }

  async clear(tripId: string | null): Promise<void> {
    const threads = this.read();
    delete threads[tripId ?? LIST_KEY];
    this.write(threads);
  }
}
