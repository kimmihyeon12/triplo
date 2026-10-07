import type { ChatMessage } from '../model/chat';
import type { ChatHistoryStore, DeviceChatThreads } from './chat-history';
import { fromChatRow, toChatRow, type ChatDataClient, type ChatRow } from './chat-data-client';

/** 한 대화에서 읽는 최대 줄 수. 서버도 같은 수만 남긴다. */
const MAX_MESSAGES = 200;
/** 옮기기 한 번에 보내는 최대 크기. 서버 상한(2MB)보다 작게 둔다. */
const IMPORT_CHUNK_BYTES = 1_500_000;
/** 서버가 받는 부가 정보 크기. 넘는 줄은 서버가 거절하므로 보내지 않는다. */
const MAX_EXTRA_BYTES = 65_536;

const encoder = new TextEncoder();
const bytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

/**
 * 서버에 남기는 대화 기록(2026-10-07). 본인만 읽는다.
 *
 * 그 계정으로 처음 읽거나 쓸 때 이 기기에 남은 대화를 한 번 서버로 옮긴다. 서버는 메시지 id로
 * 합치므로 옮기기가 실패해 다음에 다시 해도 잃는 줄이 없다. 대화별로 보내고 성공한 대화만
 * 기기에서 지운다. 쓰기는 옮기기를 기다린다. 실패는 대화를 막지 않는다. 화면 대화가 원본이다.
 */
export class SupabaseChatHistory implements ChatHistoryStore {
  private readonly imports = new Map<string, Promise<void>>();
  /** 대화별로 아직 끝나지 않은 저장. 지우기가 앞선 저장보다 먼저 도착하지 않게 한다. */
  private readonly writes = new Map<string, Promise<unknown>>();

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

  append(tripId: string | null, message: ChatMessage): Promise<void> {
    return this.queue(tripId, async () => {
      if (!(await this.ready())) return;
      await this.data.call('append_chat_message', { p_trip_id: tripId, p_message: toChatRow(message) });
    });
  }

  clear(tripId: string | null): Promise<void> {
    return this.queue(tripId, async () => {
      if (!(await this.ready())) return;
      await this.data.call('clear_chat', { p_trip_id: tripId });
    });
  }

  /** 같은 대화의 쓰기를 차례로 보낸다. 앞선 쓰기가 실패해도 다음 쓰기는 보낸다. */
  private queue(tripId: string | null, run: () => Promise<void>): Promise<void> {
    const key = tripId ?? '';
    const previous = this.writes.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(run);
    this.writes.set(key, next);
    void next.finally(() => {
      if (this.writes.get(key) === next) this.writes.delete(key);
    }).catch(() => undefined);
    return next;
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
    let threads: Record<string, readonly ChatMessage[]>;
    try {
      threads = this.device.exportThreads();
    } catch {
      // 기기 저장소를 읽을 수 없으면 옮길 것도 없다. 서버 저장은 그대로 쓴다.
      return;
    }
    await Promise.all(
      Object.entries(threads)
        .filter(([, messages]) => messages.length > 0)
        .map(([key, messages]) => this.importThread(key, messages)),
    );
  }

  private async importThread(key: string, messages: readonly ChatMessage[]): Promise<void> {
    const rows = messages.slice(-MAX_MESSAGES).map(toChatRow).filter((r) => bytes(r.extra) <= MAX_EXTRA_BYTES);
    try {
      for (const chunk of chunks(rows)) await this.data.call('import_chat_threads', { p_threads: { [key]: chunk } });
      this.device.forgetThread(key);
    } catch {
      // 기기 사본을 남긴다. 다음에 앱을 열면 다시 옮기고, 서버는 이미 받은 줄을 건너뛴다.
    }
  }
}

function chunks(rows: readonly ChatRow[]): ChatRow[][] {
  const out: ChatRow[][] = [];
  let current: ChatRow[] = [];
  let size = 0;
  for (const row of rows) {
    const rowSize = bytes(row);
    if (current.length > 0 && size + rowSize > IMPORT_CHUNK_BYTES) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += rowSize;
  }
  if (current.length > 0) out.push(current);
  return out;
}
