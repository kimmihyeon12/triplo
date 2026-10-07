import type { ChatMessage } from '../model/chat';
import type { ChatHistoryStore, DeviceChatThreads } from './chat-history';
import { fromChatRow, toChatRow, type ChatDataClient } from './chat-data-client';

/** 한 대화에서 읽는 최대 줄 수. 서버도 같은 수만 남긴다. */
const MAX_MESSAGES = 200;

/**
 * 서버에 남기는 대화 기록(2026-10-07). 본인만 읽는다.
 *
 * 그 계정으로 처음 읽거나 쓸 때 이 기기에 남은 대화를 한 번 서버로 옮긴다. 쓰기도 옮기기를
 * 기다린다. 먼저 쓰면 서버에 그 대화가 생겨 기기 기록이 건너뛰어지기 때문이다.
 * 실패는 대화를 막지 않는다. 화면 대화가 원본이다.
 */
export class SupabaseChatHistory implements ChatHistoryStore {
  private readonly imports = new Map<string, Promise<void>>();

  constructor(
    private readonly data: ChatDataClient,
    private readonly device: DeviceChatThreads,
    private readonly userId: () => string | null,
  ) {}

  async load(tripId: string | null): Promise<readonly ChatMessage[]> {
    if (!(await this.ready())) return [];
    try {
      const rows = await this.data.thread(tripId, MAX_MESSAGES);
      return rows.map(fromChatRow).filter((m): m is ChatMessage => m !== null);
    } catch {
      return [];
    }
  }

  async append(tripId: string | null, message: ChatMessage): Promise<void> {
    if (!(await this.ready())) return;
    await this.data.call('append_chat_message', { p_trip_id: tripId, p_message: toChatRow(message) });
  }

  async clear(tripId: string | null): Promise<void> {
    if (!(await this.ready())) return;
    await this.data.call('clear_chat', { p_trip_id: tripId });
  }

  /** 로그인했으면 그 계정의 옮기기를 마치고 true. */
  private async ready(): Promise<boolean> {
    const user = this.userId();
    if (!user) return false;
    let pending = this.imports.get(user);
    if (!pending) {
      pending = this.importDevice();
      this.imports.set(user, pending);
    }
    await pending;
    return true;
  }

  private async importDevice(): Promise<void> {
    const threads = this.device.exportThreads();
    const keys = Object.keys(threads).filter((k) => threads[k]!.length > 0);
    if (keys.length === 0) return;
    const payload = Object.fromEntries(keys.map((k) => [k, threads[k]!.map(toChatRow)]));
    try {
      await this.data.call('import_chat_threads', { p_threads: payload });
      this.device.forget();
    } catch {
      // 기기 사본을 남긴다. 다음에 앱을 열면 다시 옮긴다.
    }
  }
}
