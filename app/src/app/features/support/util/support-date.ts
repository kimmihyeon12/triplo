/**
 * 공지·문의 화면(사용자·관리자)의 날짜 표기. 화면마다 모양이 달랐던 것을 한 가지로 맞춘다.
 * 서버 시각(UTC)을 기기 시간대로 바꿔 보인다. 글자를 잘라 쓰면 밤 9시 이후 글이 전날로 보인다.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** 목록·답변 머리에 쓰는 날짜. 예: 2026.10.01 */
export function supportDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 관리자 상세처럼 시각까지 필요한 곳. 예: 2026.10.01 09:07 */
export function supportTime(iso: string): string {
  const d = new Date(iso);
  return `${supportDay(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
