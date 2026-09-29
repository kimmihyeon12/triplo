import { describe, expect, it } from 'vitest';
import { NetworkActivity } from './network-activity';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('NetworkActivity', () => {
  it('요청이 진행 중인 동안만 busy이고, 실패해도 끝나면 풀린다', async () => {
    const activity = new NetworkActivity();
    const first = deferred<Response>();
    const second = deferred<Response>();
    const calls = [first.promise, second.promise];
    const fetch = activity.wrap(() => calls.shift()!);
    expect(activity.busy()).toBe(false);

    const a = fetch('https://example.test/a');
    const b = fetch('https://example.test/b').catch(() => undefined);
    expect(activity.busy()).toBe(true);

    first.resolve(new Response('ok'));
    await a;
    expect(activity.busy()).toBe(true);

    second.reject(new Error('offline'));
    await b;
    expect(activity.busy()).toBe(false);
  });

  it('화면 코드 내려받기처럼 fetch가 아닌 요청도 begin·end로 센다', () => {
    const activity = new NetworkActivity();
    activity.begin();
    expect(activity.busy()).toBe(true);
    activity.end();
    expect(activity.busy()).toBe(false);
    activity.end();
    expect(activity.busy()).toBe(false);
  });
});
