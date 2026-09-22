/**
 * 여행 친구 캐릭터의 공개 진입점.
 *
 * `travel-chat.ts`와 따로 두는 이유는 순환 의존 때문이다. 그쪽은 대화 시트를
 * 내보내고 시트는 여행 모델을 쓰므로, 여행 화면이 캐릭터 하나를 쓰려고
 * 그 파일을 가져오면 두 기능이 서로를 가리키게 된다. 캐릭터는 그림 한 장이라
 * 아무것도 끌고 오지 않으므로 따로 공개한다.
 */
export { CompanionFace, type CompanionMood } from './ui/companion-face/companion-face';
