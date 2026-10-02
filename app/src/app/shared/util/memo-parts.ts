/** 메모를 'AI 추정' 목록과 사용자가 쓴 글로 나눈 결과. */
export interface MemoParts {
  /** 'AI 추정' 머리줄 아래 '- '로 시작하는 줄. 앞의 '- '는 그대로 둔다. */
  readonly estimate: readonly string[];
  /** 그 밖에 사용자가 쓴 글. */
  readonly note: string;
}

/**
 * 담을 때 저장한 메모(estimateMemo)는 'AI 추정' 머리줄과 '- ' 목록으로 시작한다.
 * 저장 형식은 그대로 두고 화면에서만 나눠, 추정은 따로 묶고 사용자가 덧붙인 글은 평소처럼 보인다.
 * '무료 (무료)'처럼 값과 괄호 안 설명이 같으면 괄호를 뺀다(2026-10-02 디자인 점검).
 */
export function memoParts(memo: string | null | undefined): MemoParts {
  const lines = (memo ?? '').split('\n');
  if (lines[0]?.trim() !== 'AI 추정') return { estimate: [], note: memo ?? '' };
  let end = 1;
  while (end < lines.length && lines[end]!.startsWith('- ')) end++;
  return {
    estimate: lines.slice(1, end).map((line) => line.replace(/ (\S+) \(\1\)$/, ' $1')),
    note: lines.slice(end).join('\n').trim(),
  };
}
