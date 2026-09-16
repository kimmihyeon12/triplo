import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';

/**
 * 시안 번호와 이름. 화살표로 넘겨 가며 실제 화면처럼 본다.
 * 사용자가 제외한 2·4·8·9·12번을 빼고 성격이 비슷한 것끼리 묶었다.
 */
const VARIANTS = [
  // 티켓: 이 앱만의 은유
  { n: 1, group: '티켓', name: '탑승권' },
  { n: 11, group: '티켓', name: '탑승권 + 기능' },
  // 지도: 동선을 바로 보여줌
  { n: 5, group: '지도', name: '지도 배경' },
  { n: 18, group: '지도', name: '지도 전면' },
  // 설명: 무엇을 하는 앱인지 말로
  { n: 3, group: '설명', name: '기능 세 줄' },
  { n: 13, group: '설명', name: '큰 문장' },
  // 결과물: 만들어진 것을 보여줌
  { n: 6, group: '결과물', name: '일정 카드' },
  { n: 17, group: '결과물', name: '카드 겹침' },
  // 기록: 쌓이는 재미
  { n: 10, group: '기록', name: '달력' },
  { n: 14, group: '기록', name: '체크리스트' },
  { n: 15, group: '기록', name: '스탬프 모음' },
  { n: 16, group: '기록', name: '영수증' },
  // 색: 브랜드를 앞세움
  { n: 7, group: '색', name: '전면 색' },
] as const;

/** 로그인 화면 시안 비교용 임시 화면. 고른 뒤 이 파일과 라우트를 지운다. */
@Component({
  selector: 'app-login-variants',
  templateUrl: './login-variants.html',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginVariants {
  readonly variants = VARIANTS;
  readonly index = signal(0);

  readonly current = computed(() => VARIANTS[this.index()]);
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() === VARIANTS.length - 1);

  shows(n: number): boolean {
    return this.current().n === n;
  }

  prev(): void {
    this.index.update((i) => (i > 0 ? i - 1 : i));
  }

  next(): void {
    this.index.update((i) => (i < VARIANTS.length - 1 ? i + 1 : i));
  }

  go(i: number): void {
    this.index.set(i);
  }

  constructor() {
    const bar = inject(PageBar);
    // 실제 로그인처럼 상단 바를 숨긴다. 같은 조건에서 봐야 판단이 맞는다.
    effect(() => bar.set({ title: '', back: null, action: null, hidden: true }));
  }
}
