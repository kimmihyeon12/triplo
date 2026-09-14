/**
 * 좌표가 없는 알파에서는 이름·주소 검색 링크만 제공한다.
 * 실제 앱 스킴·좌표 전달은 장소 연동 후 별도 검증한다.
 */
export function naverSearchUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function kakaoSearchUrl(query: string): string {
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
}

export function mapQuery(name: string, address: string): string {
  return [name.trim(), address.trim()].filter(Boolean).join(' ');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    const clip = globalThis.navigator?.clipboard;
    if (!clip) return false;
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}
