/**
 * 로그인 뒤 돌아갈 주소. 초대 링크로 들어온 사람이 로그인·닉네임 설정을 마치면
 * 다시 합류 화면으로 보낸다. 로그인은 다른 사이트를 거쳐 돌아오므로 기억해 둔다.
 *
 * 아무 주소나 받으면 로그인 뒤 다른 사이트로 보내는 통로가 된다. 그래서 이 앱의
 * 합류 주소(`/join/코드`)만 받는다.
 */
const KEY = 'tc.returnTo';
const JOIN_PATH = /^\/join\/[A-Za-z0-9-]{1,20}$/;

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function rememberReturn(path: string, store: Storage | null = storage()): void {
  try {
    if (JOIN_PATH.test(path)) store?.setItem(KEY, path);
  } catch {
    // 저장소가 막혀 있으면 돌아오기만 못 한다.
  }
}

/** 기억한 합류 주소를 한 번만 돌려주고 지운다. */
export function takeReturn(store: Storage | null = storage()): string | null {
  try {
    const path = store?.getItem(KEY) ?? null;
    store?.removeItem(KEY);
    return path && JOIN_PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}
