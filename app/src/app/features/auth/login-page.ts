import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon';
import { PageBar } from '../../shared/page-bar';

/**
 * SNS 로그인 화면.
 *
 * 아직 Supabase Auth를 연결하지 않았으므로 버튼을 눌러도 실제 로그인은 되지 않는다.
 * 준비 중임을 화면에 분명히 밝히고, 로그인 없이 쓰는 길을 항상 열어 둔다
 * (기획안 24절: 로그인 전 기기 저장 흐름을 유지한다).
 */
type Provider = 'kakao' | 'google' | 'apple';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, IconComponent],
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

      <nav class="providers" aria-label="소셜 로그인">
        <button type="button" class="sns sns--kakao" (click)="notReady('kakao')" data-testid="login-kakao">
          <img class="sns__logo" src="brand/kakaomap.png" width="20" height="20" alt="" aria-hidden="true" />
          <span>카카오로 계속하기</span>
        </button>
        <button type="button" class="sns sns--google" (click)="notReady('google')" data-testid="login-google">
          <span>구글로 계속하기</span>
        </button>
        <!--
          애플 로고 문자(U+F8FF)는 애플 기기 전용 사설 영역이라 다른 환경에서
          엉뚱한 글자로 보인다. 로고를 임의로 그리지도 않고 글자만 쓴다.
        -->
        <button type="button" class="sns sns--apple" (click)="notReady('apple')" data-testid="login-apple">
          <span>Apple로 계속하기</span>
        </button>
      </nav>

      @if (tried()) {
        <p class="tried small" role="status" data-testid="login-tried">
          {{ providerLabel[tried()!] }} 로그인은 계정 서버 연결 후 제공됩니다. 그때까지는 이 기기에 저장됩니다.
        </p>
      }

      <a class="skip-login" routerLink="/trips" data-testid="login-skip">로그인 없이 둘러보기</a>

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
        SNS 버튼: 각 서비스 브랜드 색을 배경으로 쓴다.
        카카오만 공식 로고 파일이 있어 그대로 쓰고, 구글·애플은 로고를 임의로
        그리지 않고 글자로 표시한다(상표 오사용 방지).
      */
      .sns {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--sp-2);
        width: 100%;
        min-height: 50px;
        padding: 0 var(--sp-4);
        border: 1px solid transparent;
        border-radius: var(--radius-control-lg);
        font-size: var(--fs-15);
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--dur) var(--ease-out);
      }
      .sns__logo {
        display: block;
        border-radius: var(--radius-cell);
      }
      .sns--kakao {
        background: var(--kakao-brand);
        color: var(--kakao-brand-ink);
      }
      .sns--google {
        background: var(--panel);
        border-color: var(--border-strong);
        color: var(--ink);
      }
      .sns--apple {
        background: #000000;
        color: #ffffff;
      }
      @media (hover: hover) {
        .sns:hover {
          filter: brightness(0.95);
        }
      }
      .sns:active {
        filter: brightness(0.92);
      }

      .tried {
        color: var(--warn-ink);
        background: var(--warn-tint);
        padding: var(--sp-3);
        border-radius: var(--radius-control);
        line-height: 1.6;
      }

      .skip-login {
        align-self: center;
        padding: var(--sp-3);
        font-size: var(--fs-14);
        font-weight: 600;
        color: var(--ink-2);
        text-decoration: underline;
        text-underline-offset: 0.2em;
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
    apple: 'Apple',
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
