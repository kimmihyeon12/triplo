import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon';
import { PageBar } from '../../shared/page-bar';

/**
 * SNS 로그인 화면.
 *
 * 아직 Supabase Auth를 연결하지 않았으므로 버튼을 눌러도 실제 로그인은 되지 않는다.
 * 준비 중임을 화면에 분명히 밝힌다.
 *
 * 버튼은 카카오·구글이 배포하는 공식 이미지를 그대로 쓴다. 두 회사 모두
 * 브랜드 가이드에서 로고 변형·심볼 단독 사용을 금지하고 버튼 문구도
 * 정해진 범위로 제한하므로 자체 버튼을 만들지 않는다.
 */
type Provider = 'kakao' | 'google';

@Component({
  selector: 'app-login-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page login">
      <section class="intro">
        <img class="intro__mark" src="brand/triplo-symbol.svg" width="44" height="44" alt="" aria-hidden="true" />
        <h1 class="intro__title">여행을 기기 밖에서도</h1>
        <p class="intro__sub">
          로그인하면 다른 기기에서도 같은 여행을 열고, 친구를 초대해 함께 볼 수 있습니다.
          지금은 이 기기에만 저장됩니다.
        </p>
      </section>

      <!--
        미연결 상태를 숨기지 않는다. 버튼을 눌렀을 때 아무 일도 일어나지 않으면
        고장으로 보이므로, 누르기 전에 준비 중임을 먼저 알린다.
      -->
      <div class="notice notice--warn" role="status" data-testid="login-not-ready">
        <app-icon name="alert" />
        <div class="notice__body">
          <strong>로그인은 아직 준비 중입니다.</strong>
          계정 서버를 연결하기 전이라 아래 버튼은 동작하지 않습니다.
        </div>
      </div>

      <!--
        두 버튼 모두 각 사 공식 자산에서 심볼만 가져와 같은 구조로 만든다.
        로고는 왼쪽 끝에 고정하고 문구는 가운데에 둔다.
        각 사 가이드가 정한 배경·글자 색과 로고 원형은 그대로 지킨다.
      -->
      <nav class="providers" aria-label="소셜 로그인">
        <button type="button" class="sns sns--kakao" (click)="notReady('kakao')" data-testid="login-kakao">
          <img class="sns__logo" src="brand/kakao-symbol.png" width="18" height="17" alt="" aria-hidden="true" />
          <span class="sns__label">카카오 로그인</span>
        </button>
        <button type="button" class="sns sns--google" (click)="notReady('google')" data-testid="login-google">
          <img class="sns__logo" src="brand/google-logo.svg" width="18" height="18" alt="" aria-hidden="true" />
          <span class="sns__label">구글 로그인</span>
        </button>
      </nav>

      @if (tried()) {
        <p class="tried small" role="status" data-testid="login-tried">
          {{ providerLabel[tried()!] }} 로그인은 계정 서버 연결 후 제공됩니다. 그때까지는 이 기기에 저장됩니다.
        </p>
      }

      <p class="terms small muted">
        계속하면 서비스 이용약관과 개인정보 처리방침에 동의하게 됩니다.
        약관 문서는 공개 배포 전에 작성합니다.
      </p>
    </div>
  `,
  styles: [
    `
      .login {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
        max-width: 420px;
      }

      /* 머리말: 왜 로그인하는지 한 문단으로 설명한다 */
      .intro {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--sp-2);
        padding: var(--sp-6) 0 var(--sp-2);
      }
      .intro__mark {
        color: var(--accent-deep);
      }
      .intro__title {
        font-size: var(--fs-22);
        font-weight: 700;
        line-height: 1.4;
      }
      .intro__sub {
        font-size: var(--fs-14);
        line-height: 1.6;
        color: var(--ink-2);
      }

      .providers {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
      }
      /*
        두 버튼은 같은 격자를 쓴다. 왼쪽에 로고 자리를 고정 폭으로 두고
        문구는 남은 폭 가운데에 놓아, 문구 길이가 달라도 로고가 나란히 선다.
      */
      .sns {
        display: grid;
        grid-template-columns: 44px 1fr 44px;
        align-items: center;
        width: 100%;
        height: 48px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-control-lg);
        font-size: var(--fs-15);
        font-weight: 500;
        cursor: pointer;
        transition: opacity var(--dur) var(--ease-out);
      }
      .sns__logo {
        display: block;
        justify-self: center;
      }
      .sns__label {
        text-align: center;
      }
      /* 카카오 가이드: 배경 #FEE500, 글자·심볼 검정 */
      .sns--kakao {
        background: var(--kakao-brand);
        color: #000000;
      }
      /*
        구글 가이드: 흰 배경, 글자 #1F1F1F, 로고는 표준 색상.
        테두리는 가이드의 #747775가 화면에서 너무 진해 앱 토큰으로 낮췄다.
      */
      .sns--google {
        background: #ffffff;
        box-shadow: inset 0 0 0 1px var(--border-strong);
        color: #1f1f1f;
      }
      @media (hover: hover) {
        .sns:hover {
          opacity: 0.9;
        }
      }
      .sns:active {
        opacity: 0.82;
      }

      .tried {
        color: var(--warn-ink);
        background: var(--warn-tint);
        padding: var(--sp-3);
        border-radius: var(--radius-control);
        line-height: 1.6;
      }

      .terms {
        line-height: 1.6;
        text-align: center;
      }
    `,
  ],
})
export class LoginPage {
  private readonly pageBar = inject(PageBar);

  readonly providerLabel: Record<Provider, string> = {
    kakao: '카카오',
    google: '구글',
  };

  /** 마지막으로 누른 제공자. 미연결 안내를 그 이름으로 보여준다. */
  readonly tried = signal<Provider | null>(null);

  constructor() {
    this.pageBar.set({ title: '로그인', back: ['/trips'], action: null });
  }

  notReady(provider: Provider): void {
    this.tried.set(provider);
  }
}
