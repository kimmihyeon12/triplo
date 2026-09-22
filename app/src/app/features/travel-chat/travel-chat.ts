/**
 * 대화형 여행 탐색의 공개 진입점.
 *
 * 다른 기능은 이 파일이 내보내는 것만 쓴다. 안쪽 파일을 직접 가리키면 폴더를
 * 정리할 때마다 밖에서 고쳐야 하고, 경계 검사도 막는다.
 */
export { ChatSheet } from './feature/chat-sheet/chat-sheet';
export { CHAT_PROVIDER, type ChatProvider } from './data/chat-provider';
export { CHAT_HISTORY, LocalChatHistory, type ChatHistoryStore } from './data/chat-history';
export { FixtureChatProvider } from './data/fixture-chat-provider';
export { AiDisclaimer } from './ui/ai-disclaimer/ai-disclaimer';
export type { ReferenceNote, ReferenceLink } from './model/chat';
export { referenceLinks } from './util/chat-scope';
