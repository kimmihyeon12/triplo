/**
 * 글을 클립보드에 복사한다. 성공하면 true, 클립보드가 없거나 권한이 막히면 false를 돌려준다.
 * 실패 안내는 화면마다 다르므로 부르는 쪽이 정한다.
 *
 * 예전에는 지도 링크 모음(places/data/map-links.ts)에 있어서, 정산·초대·채팅이 복사
 * 하나 때문에 지도 기능을 참조했다(리팩터링 제안 R6·C6).
 */
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
