import { Injectable, signal } from '@angular/core';

/** 기기에 남기는 화면 테마 열쇠. index.html의 첫 적용 스크립트와 같은 이름이어야 한다. */
export const THEME_KEY = 'tc.theme.v1';

/** 상태 표시줄 색. 상단 바(panel)와 같아야 상태 표시줄이 화면으로 이어져 보인다. */
const BAR_COLOR = { light: '#ffffff', dark: '#18191c' } as const;

export type ThemeName = 'light' | 'dark';

/** 저장된 값을 읽는다. 저장소가 막혔거나 값이 낯설면 기본인 라이트다. */
export function readTheme(storage: Pick<Storage, 'getItem'> | null): ThemeName {
  try {
    return storage?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * 화면 테마(2026-10-06). 기본은 라이트이고 계정 화면에서 다크 모드를 켜고 끈다.
 *
 * 기기 설정(prefers-color-scheme)을 따르지 않는다. 사용자가 고른 것만 바꾼다.
 * 선택은 계정이 아니라 기기에 남긴다. 휴대폰은 다크, PC는 라이트처럼 기기마다 다르게 쓸 수 있다.
 * 색은 theme.css의 `:root[data-theme='dark']`가 토큰을 바꿔 칠한다.
 */
@Injectable({ providedIn: 'root' })
export class ThemeMode {
  private readonly storage = typeof localStorage === 'undefined' ? null : localStorage;
  private readonly current = signal<ThemeName>(readTheme(this.storage));
  readonly theme = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  isDark(): boolean {
    return this.current() === 'dark';
  }

  setDark(on: boolean): void {
    const next: ThemeName = on ? 'dark' : 'light';
    this.current.set(next);
    try {
      this.storage?.setItem(THEME_KEY, next);
    } catch {
      // 저장소가 막힌 브라우저에서도 지금 화면에는 적용한다.
    }
    this.apply(next);
  }

  private apply(theme: ThemeName): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') root.dataset['theme'] = 'dark';
    else delete root.dataset['theme'];
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme]);
  }
}
