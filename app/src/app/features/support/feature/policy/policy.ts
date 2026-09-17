import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { PRIVACY_POLICY, TERMS_OF_SERVICE, type PolicyDoc } from '../../model/policy';

/**
 * 개인정보 처리방침과 이용약관.
 *
 * 두 글은 형태가 같아 한 화면이 맡는다. 라우트가 넘기는 kind로 어느 글인지
 * 정한다. 화면을 둘로 나누면 같은 코드가 두 벌이 된다.
 */
@Component({
  selector: 'app-policy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './policy.html',
})
export class PolicyPage {
  readonly kind = input.required<'privacy' | 'terms'>();

  readonly doc = computed<PolicyDoc>(() =>
    this.kind() === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY,
  );

  private readonly bar = inject(PageBar);

  constructor() {
    // 라우트 입력이 준비된 뒤에 제목을 정해야 한다. 생성자에서 kind()를
    // 바로 읽으면 아직 값이 없다.
    queueMicrotask(() => {
      this.bar.set({ title: this.doc().title, back: ['/account'], action: null });
    });
  }
}
