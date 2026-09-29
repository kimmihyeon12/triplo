import { computed, Injectable, signal, type Signal } from '@angular/core';

export type AiKind = 'plan' | 'chat' | 'receipt';

const LABEL: Record<AiKind, string> = {
  plan: 'AI 일정 만들기를',
  chat: '챗봇 질문을',
  receipt: '사진 읽기를',
};

/**
 * 서버가 알려 준 오늘 남은 AI 사용 횟수. 기능 근처에 거의 다 썼을 때만 보인다.
 * 서버가 한도를 정하므로 앱은 숫자를 가정하지 않고 응답을 그대로 쓴다.
 */
@Injectable({ providedIn: 'root' })
export class AiQuota {
  private readonly left = signal<Partial<Record<AiKind, number>>>({});
  readonly remaining = this.left.asReadonly();

  record(kind: AiKind, remaining: unknown): void {
    if (typeof remaining !== 'number' || !Number.isInteger(remaining) || remaining < 0) return;
    this.left.update((all) => ({ ...all, [kind]: remaining }));
  }

  hint(kind: AiKind): Signal<string | null> {
    return computed(() => {
      const n = this.left()[kind];
      return n !== undefined && n <= 3 ? `오늘 ${n}번 남음` : null;
    });
  }
}

/** 한도 오류를 사용자가 읽을 문장으로. 한도와 관계없는 오류는 null. */
export function aiLimitMessage(kind: AiKind, error: unknown): string | null {
  const code = error instanceof Error ? error.message : '';
  if (code === 'user_limit') {
    const body = (error as { body?: Record<string, unknown> }).body ?? {};
    const limit = typeof body['limit'] === 'number' ? body['limit'] : null;
    return limit === null
      ? `오늘 ${LABEL[kind]} 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.`
      : `오늘 ${LABEL[kind]} ${limit}번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.`;
  }
  if (code === 'quota_exceeded') {
    const base = '오늘 AI 무료 사용량이 모두 소진됐어요. 오후 5시쯤 다시 쓸 수 있어요.';
    return kind === 'receipt' ? `${base} 지금은 직접 입력해 주세요.` : base;
  }
  return null;
}
