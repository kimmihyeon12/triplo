import { expect, it } from 'vitest';
import { ticketNo } from './ticket-no';

const ID = '9cd40e7d-8268-4e8a-a6c1-27aea4a8caae';

it('여행 id마다 영문과 숫자를 섞은 고정 길이 티켓 번호를 만든다', () => {
  expect(ticketNo(ID)).toMatch(/^TR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

it('같은 여행 id는 항상 같은 번호를 낸다', () => {
  expect(ticketNo(ID)).toBe(ticketNo(ID));
});

it('다른 여행 id는 다른 번호를 낸다', () => {
  const others = [
    '9cd40e7d-8268-4e8a-a6c1-27aea4a8caaf',
    '1cd40e7d-8268-4e8a-a6c1-27aea4a8caae',
    'id-abc12345',
    'id-abc12346',
  ];
  const numbers = new Set([ticketNo(ID), ...others.map(ticketNo)]);
  expect(numbers.size).toBe(others.length + 1);
});

it('헷갈리는 글자를 쓰지 않는다', () => {
  const ids = Array.from({ length: 300 }, (_, i) => `trip-${i}-${i * 7919}`);
  for (const id of ids) expect(ticketNo(id)).not.toMatch(/[IO01]/);
});

it('빈 id에도 형식을 지킨 번호를 만든다', () => {
  expect(ticketNo('')).toMatch(/^TR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});
