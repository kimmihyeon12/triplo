/** 열거나 돌아온 뒤 이 시간 안에 새 버전이 준비되면 바로 새로고침한다(아직 아무것도 입력하기 전). */
export const RELOAD_WINDOW_MS = 10_000;

/** 막 열었거나 막 돌아온 참인지. */
export function freshlyOpened(lastOpenedAt: number, now: number): boolean {
  return now - lastOpenedAt <= RELOAD_WINDOW_MS;
}
