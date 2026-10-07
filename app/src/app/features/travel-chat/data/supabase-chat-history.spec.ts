import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../model/chat';
import type { DeviceChatThreads } from './chat-history';
import { fromChatRow, toChatRow, type ChatDataClient, type ChatRow } from './chat-data-client';
import { SupabaseChatHistory } from './supabase-chat-history';

const message = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, role: 'assistant', kind: 'explore', text: `말 ${id}`, reference: null, draft: null, chips: [], at: '2026-10-07T00:00:00.000Z', ...extra,
});

function fakeData(rows: ChatRow[] = []) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  let fail = false;
  const data: ChatDataClient = {
    thread: vi.fn(async () => { if (fail) throw new Error('offline'); return rows; }),
    call: vi.fn(async (fn, args) => { calls.push({ fn, args }); if (fail) throw new Error('offline'); return 0; }),
  };
  return { data, calls, failNext: () => { fail = true; }, recover: () => { fail = false; } };
}

function fakeDevice(threads: Record<string, readonly ChatMessage[]> = {}) {
  const device: DeviceChatThreads & { forgotten: string[] } = {
    forgotten: [],
    exportThreads: () => threads,
    forgetThread(key) { this.forgotten.push(key); },
  };
  return device;
}

describe('chat row 변환', () => {
  it('부가 정보를 extra로 묶었다가 그대로 되살린다', () => {
    const original = message('m1', { chips: ['더 보기'], localLink: '/trips/t1', localLinkLabel: '여행 보기', copyText: '복사' });
    const row = toChatRow(original);
    expect(row.extra).toEqual({ reference: null, draft: null, chips: ['더 보기'], localLink: '/trips/t1', localLinkLabel: '여행 보기', copyText: '복사' });
    expect(fromChatRow({ ...row, extra: row.extra })).toEqual(original);
  });

  it('형식이 틀린 줄은 버린다', () => {
    expect(fromChatRow({ id: 'x', role: 'bot', kind: null, text: 'a', extra: {}, at: '2026-10-07T00:00:00Z' })).toBeNull();
  });
});

describe('SupabaseChatHistory', () => {
  it('대화를 읽고, 새 줄과 지우기를 서버 함수로 보낸다', async () => {
    const { data, calls } = fakeData([toChatRow(message('m1')) as ChatRow]);
    const history = new SupabaseChatHistory(data, fakeDevice(), () => 'a');
    expect((await history.load('t1')).map((m) => m.id)).toEqual(['m1']);
    expect(data.thread).toHaveBeenCalledWith('t1', 200);
    await history.append('t1', message('m2'));
    await history.clear(null);
    expect(calls.map((c) => c.fn)).toEqual(['append_chat_message', 'clear_chat']);
    expect(calls[0]!.args).toEqual({ p_trip_id: 't1', p_message: toChatRow(message('m2')) });
    expect(calls[1]!.args).toEqual({ p_trip_id: null });
  });

  it('불러오기가 실패하면 빈 대화로 연다', async () => {
    const fake = fakeData();
    fake.failNext();
    const history = new SupabaseChatHistory(fake.data, fakeDevice(), () => 'a');
    await expect(history.load(null)).resolves.toEqual([]);
  });

  it('처음 읽기 전에 기기 기록을 한 번 옮기고 기기 사본을 지운다', async () => {
    const { data, calls } = fakeData();
    const device = fakeDevice({ __list__: [message('old')] });
    const history = new SupabaseChatHistory(data, device, () => 'a');
    await history.load(null);
    await history.load('t1');
    expect(calls.filter((c) => c.fn === 'import_chat_threads')).toEqual([
      { fn: 'import_chat_threads', args: { p_threads: { __list__: [toChatRow(message('old'))] } } },
    ]);
    expect(device.forgotten).toEqual(['__list__']);
  });

  it('옮기기 전에 보낸 말은 옮기기가 끝난 뒤에 저장한다', async () => {
    const { data, calls } = fakeData();
    const history = new SupabaseChatHistory(data, fakeDevice({ __list__: [message('old')] }), () => 'a');
    await history.append(null, message('new'));
    expect(calls.map((c) => c.fn)).toEqual(['import_chat_threads', 'append_chat_message']);
  });

  it('옮기기가 실패하면 기기 사본을 남긴다', async () => {
    const fake = fakeData();
    const device = fakeDevice({ __list__: [message('old')] });
    fake.failNext();
    const history = new SupabaseChatHistory(fake.data, device, () => 'a');
    await history.load(null);
    expect(device.forgotten).toEqual([]);
  });

  it('기기 기록이 없으면 옮기기를 부르지 않는다', async () => {
    const { data, calls } = fakeData();
    await new SupabaseChatHistory(data, fakeDevice(), () => 'a').load(null);
    expect(calls).toEqual([]);
  });

  it('계정이 바뀌면 그 계정의 기기 기록을 따로 옮긴다', async () => {
    const { data, calls } = fakeData();
    let user = 'a';
    const history = new SupabaseChatHistory(data, fakeDevice({ __list__: [message('old')] }), () => user);
    await history.load(null);
    user = 'b';
    await history.load(null);
    expect(calls.filter((c) => c.fn === 'import_chat_threads')).toHaveLength(2);
  });

  it('로그인하지 않았으면 읽기는 빈 대화, 쓰기는 하지 않는다', async () => {
    const { data, calls } = fakeData();
    const history = new SupabaseChatHistory(data, fakeDevice({ __list__: [message('old')] }), () => null);
    expect(await history.load(null)).toEqual([]);
    await history.append(null, message('m'));
    expect(calls).toEqual([]);
  });

  it('대화마다 나눠 옮기고 성공한 대화만 기기에서 지운다', async () => {
    const calls: string[] = [];
    const data: ChatDataClient = {
      thread: async () => [],
      call: async (_fn, args) => {
        const keys = Object.keys(args['p_threads'] as object);
        calls.push(keys.join(','));
        if (keys.includes('t1')) throw new Error('offline');
        return 1;
      },
    };
    const device = fakeDevice({ __list__: [message('a')], t1: [message('b')] });
    await new SupabaseChatHistory(data, device, () => 'u').load(null);
    expect(calls.sort()).toEqual(['__list__', 't1']);
    expect(device.forgotten).toEqual(['__list__']);
  });

  it('큰 대화는 서버 상한보다 작게 나눠 보내고, 서버가 받지 않을 큰 줄은 뺀다', async () => {
    const sizes: number[] = [];
    const ids: string[] = [];
    const data: ChatDataClient = {
      thread: async () => [],
      call: async (_fn, args) => {
        sizes.push(new TextEncoder().encode(JSON.stringify(args['p_threads'])).length);
        ids.push(...((args['p_threads'] as Record<string, { id: string }[]>)['t1'] ?? []).map((r) => r.id));
        return 0;
      },
    };
    const big = 'x'.repeat(60_000);
    const lines = Array.from({ length: 40 }, (_, i) => message(`m${i}`, { copyText: big }));
    const tooBig = message('huge', { copyText: 'y'.repeat(70_000) });
    const device = fakeDevice({ t1: [...lines, tooBig] });
    await new SupabaseChatHistory(data, device, () => 'u').load('t1');
    expect(sizes.length).toBeGreaterThan(1);
    expect(Math.max(...sizes)).toBeLessThan(1_500_000);
    expect(ids).toEqual(lines.map((m) => m.id));
    expect(device.forgotten).toEqual(['t1']);
  });

  it('기기 저장소를 읽을 수 없어도 서버 대화를 읽고 쓴다', async () => {
    const { data, calls } = fakeData([toChatRow(message('m1'))]);
    const device: DeviceChatThreads = {
      exportThreads: () => { throw new DOMException('blocked', 'SecurityError'); },
      forgetThread: () => undefined,
    };
    const history = new SupabaseChatHistory(data, device, () => 'u');
    expect((await history.load(null)).map((m) => m.id)).toEqual(['m1']);
    await history.append(null, message('m2'));
    expect(calls.map((c) => c.fn)).toEqual(['append_chat_message']);
  });

  it('지우기는 앞서 보낸 줄의 저장이 끝난 뒤에 보낸다', async () => {
    const finished: string[] = [];
    let release: () => void = () => undefined;
    const data: ChatDataClient = {
      thread: async () => [],
      call: async (fn) => {
        if (fn === 'append_chat_message') await new Promise<void>((r) => (release = r));
        finished.push(fn);
        return null;
      },
    };
    const history = new SupabaseChatHistory(data, fakeDevice(), () => 'u');
    const appending = history.append(null, message('m1'));
    const clearing = history.clear(null);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([appending, clearing]);
    expect(finished).toEqual(['append_chat_message', 'clear_chat']);
  });
});
