import { computed, DestroyRef, inject, Injectable } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';
import { nicknameFrom, normalizeNickname } from '../util/nickname';

/** Authentication only; travel drafts remain device data until the DB migration. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly state = signalState({
    loading: true,
    busy: false,
    activity: null as 'login' | 'logout' | 'delete' | 'profile' | null,
    signingProvider: null as 'google' | 'kakao' | null,
    googleEnabled: true,
    kakaoEnabled: false,
    configured: false,
    deletionEnabled: false,
    deleted: false,
    /** True while a provider redirect is being consumed, whatever path it landed on. */
    resolvingCallback: false,
    user: null as User | null,
    error: null as string | null,
  });
  private client: SupabaseClient | null = null;
  private initialization: Promise<void> | null = null;
  readonly loading = this.state.loading;
  readonly designPreview = environment.designPreview;
  readonly busy = this.state.busy;
  readonly activity = this.state.activity;
  readonly signingProvider = this.state.signingProvider;
  readonly googleEnabled = this.state.googleEnabled;
  readonly kakaoEnabled = this.state.kakaoEnabled;
  readonly nickname = computed(() => nicknameFrom(this.state.user()?.user_metadata));
  readonly user = this.state.user;
  readonly error = this.state.error;
  readonly deletionEnabled = this.state.deletionEnabled;
  readonly deleted = this.state.deleted;
  readonly resolvingCallback = this.state.resolvingCallback;
  readonly available = computed(
    () => this.state.configured() && !this.state.loading() && !this.state.busy(),
  );

  constructor() {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) patchState(this.state, { busy: false, activity: null });
    };
    window.addEventListener('pageshow', restore);
    this.destroyRef.onDestroy(() => window.removeEventListener('pageshow', restore));
  }

  initialize(): Promise<void> {
    return (this.initialization ??= this.load());
  }

  clearError(): void {
    patchState(this.state, { error: null });
  }

  /** Called once the post-redirect route has been decided. */
  settleCallback(): void {
    if (this.state.resolvingCallback()) patchState(this.state, { resolvingCallback: false });
  }

  private async load(): Promise<void> {
    const callback = new URL(location.href);
    const fragment = new URLSearchParams(callback.hash.slice(1));
    const param = (name: string) => callback.searchParams.get(name) ?? fragment.get(name);
    // Supabase falls back to the Site URL when `redirectTo` is not allowed, so trust the
    // parameters rather than the path; otherwise a stray redirect discards the grant.
    const code = param('code');
    const providerError = param('error');
    if (providerError) {
      console.error('[auth] provider callback failed', {
        error: providerError,
        code: param('error_code'),
        description: param('error_description'),
      });
    }
    if (code || providerError) {
      // Hold the account/login surface back until the redirect resolves and routing settles.
      patchState(this.state, { resolvingCallback: true });
      history.replaceState(history.state, '', callback.pathname);
    }
    try {
      const file = environment.isTest ? '/supabase-config.test.json' : '/supabase-config.json';
      const response = await fetch(file, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('config');
      const config = (await response.json()) as {
        url?: string;
        publishableKey?: string;
        accountDeletionEnabled?: boolean;
        kakaoLoginEnabled?: boolean;
      };
      const url = new URL(config.url ?? '');
      if (
        url.protocol !== 'https:' ||
        !config.publishableKey?.startsWith('sb_publishable_') ||
        config.publishableKey.includes('REPLACE_ME')
      )
        throw new Error('config');
      this.client = createClient(url.origin, config.publishableKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
          storageKey: environment.isTest ? 'tc.test.auth.v1' : 'tc.auth.v1',
        },
      });
      const { data: listener } = this.client.auth.onAuthStateChange((_event, session) => {
        patchState(this.state, { user: session?.user ?? null });
        if (
          !environment.designPreview &&
          _event === 'SIGNED_OUT' &&
          /^\/(trips|account|onboarding)(\/|\?|$)/.test(this.router.url)
        ) {
          void this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      });
      this.destroyRef.onDestroy(() => {
        listener.subscription.unsubscribe();
        this.client?.auth.stopAutoRefresh();
      });
      patchState(this.state, {
        configured: true,
        deletionEnabled: config.accountDeletionEnabled === true,
      });
      if (environment.isTest) {
        patchState(this.state, { kakaoEnabled: config.kakaoLoginEnabled === true });
      } else {
        try {
          const settings = await fetch(`${url.origin}/auth/v1/settings`, {
            headers: { apikey: config.publishableKey },
            signal: AbortSignal.timeout(5_000),
          });
          if (settings.ok) {
            const value = (await settings.json()) as {
              external?: { google?: boolean; kakao?: boolean };
            };
            patchState(this.state, {
              googleEnabled: value.external?.google === true,
              kakaoEnabled: value.external?.kakao === true,
            });
          }
        } catch {
          /* Session restoration remains available when provider settings cannot be read. */
        }
      }
      if (providerError) {
        patchState(this.state, {
          error:
            providerError === 'access_denied'
              ? '로그인을 취소했습니다. 다시 로그인할 수 있습니다.'
              : // `server_error` means the provider rejected the exchange; retrying cannot help.
                providerError === 'server_error'
                ? '소셜 로그인 연동에 문제가 있어 로그인하지 못했습니다. 다른 방법으로 로그인해 주세요.'
                : '로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
        });
      } else if (code) {
        const { error } = await this.client.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[auth] code exchange failed', error);
          patchState(this.state, {
            error: '로그인 확인에 실패했습니다. 로그인 버튼을 눌러 다시 시도해 주세요.',
          });
        }
      }
      const { data, error } = await this.client.auth.getSession();
      if (error)
        patchState(this.state, {
          error: '로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.',
        });
      patchState(this.state, { user: data.session?.user ?? null });
    } catch (cause) {
      console.error('[auth] load() threw', cause);
      patchState(this.state, {
        error: this.state.configured()
          ? '로그인 연결에 실패했습니다. 새로고침 후 다시 시도해 주세요.'
          : '로그인 설정을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.',
      });
    } finally {
      patchState(this.state, { loading: false });
    }
  }

  async signIn(provider: 'google' | 'kakao'): Promise<void> {
    if (!this.available() || !this.client) return;
    if (provider === 'google' ? !this.state.googleEnabled() : !this.state.kakaoEnabled()) return;
    patchState(this.state, {
      busy: true,
      activity: 'login',
      signingProvider: provider,
      error: null,
      deleted: false,
    });
    try {
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          skipBrowserRedirect: true,
          // `scopes` appends to Kakao defaults; singular `scope` replaces them.
          // Supabase's Kakao provider must allow users without an email.
          ...(provider === 'kakao' ? { queryParams: { scope: 'profile_nickname' } } : {}),
        },
      });
      if (error || !data.url) throw error ?? new Error('No authorization URL');
      location.assign(data.url);
    } catch {
      patchState(this.state, {
        busy: false,
        activity: null,
        error: '로그인 화면을 열지 못했습니다. 다시 시도해 주세요.',
      });
    }
  }

  async signOut(): Promise<void> {
    if (!this.available() || !this.client) return;
    patchState(this.state, { busy: true, activity: 'logout', error: null });
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      patchState(this.state, { user: null });
    } catch {
      patchState(this.state, {
        error: this.state.user()
          ? '로그아웃하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'
          : '이 기기에서는 로그아웃했습니다. 서버의 세션 해제는 확인하지 못했습니다.',
      });
    } finally {
      patchState(this.state, { busy: false, activity: null });
    }
  }

  /**
   * Edge Function을 부른다. 로그인 토큰은 클라이언트가 알아서 실어 보낸다.
   * 서버가 돌려준 오류 코드를 그대로 던져 부르는 쪽이 사정을 구분하게 한다.
   */
  async callFunction<T>(name: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    if (!this.client) throw new Error('server_unavailable');
    const { data, error } = await this.client.functions.invoke(name, { body, signal });
    if (!error) return data as T;
    // 상태 코드가 400대·500대면 응답 본문에 우리가 정한 코드가 들어 있다.
    // 그것을 꺼내 던져야 '하루 한도'와 '그 밖의 실패'를 나눌 수 있다.
    const response = (error as { context?: Response }).context;
    if (response instanceof Response) {
      const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
      if (parsed?.error) throw new Error(parsed.error);
    }
    throw new Error('function_failed');
  }

  async deleteAccount(confirmation: string): Promise<boolean> {
    if (
      !this.available() ||
      !this.state.user() ||
      !this.state.deletionEnabled() ||
      confirmation !== '탈퇴' ||
      !this.client
    )
      return false;
    patchState(this.state, { busy: true, activity: 'delete', error: null });
    try {
      const { data, error } = await this.client.functions.invoke('delete-account', {
        body: { confirmation: 'DELETE' },
      });
      if (error || data?.deleted !== true) throw error ?? new Error('Deletion not confirmed');
      // The user no longer exists; clear this browser's session without touching device trips.
      await this.client.auth.signOut({ scope: 'local' });
      patchState(this.state, { user: null, deleted: true });
      return true;
    } catch {
      patchState(this.state, {
        error: '회원탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
      return false;
    } finally {
      patchState(this.state, { busy: false, activity: null });
    }
  }

  async saveNickname(value: string): Promise<boolean> {
    if (!this.available() || !this.client || !this.state.user()) return false;
    const nickname = normalizeNickname(value);
    if (!nickname) {
      patchState(this.state, { error: '닉네임은 2~20자로 입력해 주세요.' });
      return false;
    }
    patchState(this.state, { busy: true, activity: 'profile', error: null });
    try {
      const { data, error } = await this.client.auth.updateUser({
        data: { travel_nickname: nickname },
      });
      if (error || !data.user || nicknameFrom(data.user.user_metadata) !== nickname)
        throw error ?? new Error('Nickname not saved');
      patchState(this.state, { user: data.user });
      return true;
    } catch {
      patchState(this.state, { error: '닉네임을 저장하지 못했습니다. 다시 시도해 주세요.' });
      return false;
    } finally {
      patchState(this.state, { busy: false, activity: null });
    }
  }
}
