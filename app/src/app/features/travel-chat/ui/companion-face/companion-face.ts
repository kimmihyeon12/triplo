import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 구름이 전신 이미지. 대기는 졸림, 응답에는 승인된 작은 미소를 사용한다. */

/** 어떤 얼굴을 보일지. 대화의 상태와 이어진다. */
export type CompanionMood =
  /** 채팅을 열기 전 대기. */
  | 'idle'
  /** 답을 건네거나 준비할 때. */
  | 'talking'
  /** 갈 곳을 찾았을 때도 승인된 작은 미소를 사용한다. */
  | 'found';

const FACE: Record<CompanionMood, string> = {
  idle: '/brand/companion-cloud-sleepy-v1.png',
  talking: '/brand/companion-cloud-sorry-v1.png',
  found: '/brand/companion-cloud-sorry-v1.png',
};

/** 얼굴마다 다른 설명. 표정이 뜻을 담고 있으므로 읽어 주는 값도 달라야 한다. */
const LABEL: Record<CompanionMood, string> = {
  idle: '쉬고 있는 구름이',
  talking: '구름이가 답합니다',
  found: '구름이가 갈 곳을 찾았습니다',
};

@Component({
  selector: 'app-companion-face',
  templateUrl: './companion-face.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-none' },
})
export class CompanionFace {
  readonly mood = input<CompanionMood>('idle');
  /** 그림의 한 변 길이(px). 정사각형이다. */
  readonly size = input(40);
  /**
   * 장식으로만 쓸 때 참으로 둔다. 옆에 같은 뜻의 글이 있으면 두 번 읽히므로
   * 화면 낭독기에서 감춘다.
   */
  readonly decorative = input(false);

  readonly src = computed(() => FACE[this.mood()]);
  readonly label = computed(() => (this.decorative() ? null : LABEL[this.mood()]));
}
