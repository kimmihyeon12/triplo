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
  const device: DeviceChatThreads & { forgotten: number } = {
    forgotten: 0,
    exportThreads: () => threads,
    forget() { this.forgotten += 1; },
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
    expect(device.forgotten).toBe(1);
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
    expect(device.forgotten).toBe(0);
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
});
