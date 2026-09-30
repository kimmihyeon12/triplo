/** 서버 함수가 돌려준 오류. message는 서버가 정한 코드, body는 응답 본문 전체다. */
export class FunctionError extends Error {
  constructor(
    code: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
