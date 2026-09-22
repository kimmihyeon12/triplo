import { Injectable } from '@angular/core';
import { OUT_OF_SCOPE_REPLY, type ChatReply } from '../model/chat';
import { classifyQuestion, referenceLinks } from '../util/chat-scope';
import type { ChatProvider, ChatRequest } from './chat-provider';

/**
 * 고정 응답 제공자. 외부를 부르지 않고 정해진 답을 돌려준다.
 *
 * 13-A에서 화면 흐름을 검증하는 데 쓰고, E2E에서도 같은 것을 쓴다. 실제
 * 모델은 13-B에서 붙이며 그때 이 파일은 테스트 전용으로 남는다.
 *
 * 입력의 열쇳말로 갈래를 고르므로 검증하려는 경로를 문장으로 지정할 수 있다.
 * 무작위로 답하면 어느 화면을 보고 있는지 알 수 없어 검증이 되지 않는다.
 */

/** 초안 경로를 검증할 장소. 앞 세 개는 픽스처 검색에 있어 '확인됨'이 된다. */
const DRAFT_PLACES = [
  { day: 1, name: '안목해변', kind: 'place' as const },
  { day: 1, name: '오죽헌', kind: 'place' as const },
  { day: 2, name: '속초관광수산시장', kind: 'meal' as const },
  // 일부러 없는 이름을 두어 '담을 수 없는 장소' 경로를 검증한다.
  { day: 2, name: '없는장소테스트', kind: 'place' as const },
];

/** 테스트에서 실패·지연을 흉내 내기 위한 값. 테스트 앱에서만 설정한다. */
const FAIL_FLAG = 'tc.test.chatFail';
const DELAY_FLAG = 'tc.test.chatDelayMs';

@Injectable({ providedIn: 'root' })
export class FixtureChatProvider implements ChatProvider {
  async availability(): Promise<{ available: boolean; reason: string | null }> {
    return { available: true, reason: null };
  }

  async reply(request: ChatRequest, signal: AbortSignal): Promise<ChatReply> {
    const delay = Number(localStorage.getItem(DELAY_FLAG) ?? 0);
    if (delay > 0) await waitOrAbort(delay, signal);
    const fail = localStorage.getItem(FAIL_FLAG);
    if (fail === '1') throw new Error('AI 서버에 연결하지 못했습니다.');
    if (fail === 'quota') throw new Error('오늘 사용량을 모두 썼습니다.');
    if (fail === 'timeout') throw new Error('응답이 오래 걸립니다.');

    const text = request.input.trim();
    const kind = classifyQuestion(text);

    if (kind === 'refusal') return base({ kind, text: OUT_OF_SCOPE_REPLY });
    if (kind === 'outside')
      return base({
        kind,
        text: '예약이나 교통편은 아직 도와드리지 못해요. 대신 어디를 갈지 일정부터 함께 짜 볼까요?',
      });
    if (kind === 'reference') return referenceReply(text);

    // 일정을 만들어 달라는 뜻이 분명할 때만 초안을 낸다. 묻지 않은 일을
    // 하지 않는다는 규칙에 따라, 그냥 물어본 말에는 초안을 붙이지 않는다.
    if (wantsPlan(text)) return draftReply(request);

    return base({
      kind: 'explore',
      text: '강릉과 속초를 묶으면 이동이 짧아 2박 3일에 맞습니다. 바다를 볼지 산을 볼지 정하면 더 좁혀 드릴게요.',
      regions: ['강릉'],
      chips: ['강릉으로 일정 짜줘', '속초는 어때', '바다 쪽으로 보고 싶어', '다른 지역도 볼래'],
    });
  }
}

function base(partial: Partial<ChatReply> & Pick<ChatReply, 'kind' | 'text'>): ChatReply {
  return { reference: null, chips: [], places: [], regions: [], edit: null, ...partial };
}

/** 일정을 만들어 달라는 뜻인지. 애매하면 초안을 내지 않고 되묻는 쪽을 택한다. */
function wantsPlan(text: string): boolean {
  return ['짜줘', '짜 줘', '만들어', '추천해줘', '일정', '담아', '추가'].some((w) =>
    text.includes(w),
  );
}

/**
 * 참고 정보. 확인되지 않은 답이므로 구분 표시와 확인 링크를 함께 돌려준다.
 * 이 값은 대화에만 쓰고 일정에 저장하지 않는다.
 */
function referenceReply(text: string): ChatReply {
  const subject = guessSubject(text);
  return base({
    kind: 'reference',
    text: `${subject}의 영업정보를 확인해 보세요.`,
    reference: {
      subject,
      body: '보통 오전 9시부터 오후 6시까지 운영하며, 명절에는 다를 수 있습니다.',
      links: referenceLinks(subject, ''),
    },
    chips: ['다른 곳도 알려줘', '근처에 뭐가 있어'],
  });
}

/**
 * 무엇에 대해 물었는지 앞말에서 집는다. 조사나 의문사를 빼고 남는 첫 낱말을
 * 쓴다. 정확하지 않아도 확인 링크의 검색어로 쓰이므로 사용자가 직접 확인한다.
 */
function guessSubject(text: string): string {
  const head = text.split(/\s+/)[0] ?? '';
  const cleaned = head.replace(/(은|는|이|가|을|를|의|에|도)$/u, '');
  return cleaned.length >= 2 ? cleaned : '이 장소';
}

/** 일정 초안. 장소 이름과 일차만 낸다. 좌표는 store가 장소 검색으로 채운다. */
function draftReply(request: ChatRequest): ChatReply {
  const dayCount = request.trip?.dayCount ?? 2;
  const places = DRAFT_PLACES.filter((p) => p.day <= Math.max(1, dayCount));
  return base({
    kind: 'draft',
    text:
      request.scope === 'trip'
        ? '일정에 더할 만한 곳을 찾았어요. 확인하고 담아 주세요.'
        : '이런 일정은 어떠세요? 담고 싶은 곳만 골라 주세요.',
    places,
    regions: request.trip?.regions.length ? [...request.trip.regions] : ['강릉', '속초'],
    chips: ['다른 곳으로 바꿔줘', '카페도 넣어줘'],
  });
}

/** 기다리는 동안 그만두면 바로 멈춘다. */
function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new DOMException('중단됨', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
