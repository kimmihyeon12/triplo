/**
 * 금액을 원화로 적는다. 예: 12,000원.
 *
 * 로케일을 ko-KR로 고정한다. 예전에는 곳마다 toLocaleString()에 로케일을 적거나 빼서,
 * 기본 로케일이 다른 환경에서 표시가 달라질 수 있었다(리팩터링 제안 C5).
 * '예상'·'미정'·'잔액' 같은 문구는 부르는 쪽에 둔다. 계산·반올림은 하지 않는다.
 */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
