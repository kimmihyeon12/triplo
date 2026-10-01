import { ChangeDetectionStrategy, Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import type { PlaceCandidate } from '../../model/place';
import { linkProvider } from '../../model/place-link';
import { PLACE_LINK_RESOLVER, linkErrorMessage } from '../../data/place-link-resolver';
import { PLACE_SEARCH } from '../../data/place-search';
import { matchLinkedPlace } from '../../util/match-link-place';

/** 링크 좌표 근처에서 같은 장소를 찾을 반경(m). */
const NEAR_RADIUS = 300;

/**
 * 지도 링크로 장소 담기(2026-10-01). 네이버·카카오 지도에서 복사한 링크를 붙여 넣으면
 * 서버가 장소를 읽고, 카카오 검색에서 같은 곳을 찾으면 그 후보를, 없으면 링크의 값을 넘긴다.
 * 설계: docs/superpowers/specs/2026-10-01-place-link-import-design.md
 * 기본은 접혀 있다. 대부분은 이름으로 바로 검색하므로 펼쳐 두면 검색 상자가 밀린다.
 */
@Component({
  selector: 'app-place-link-box',
  imports: [UiButton, UiInput, UiNotice, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './place-link-box.html',
})
export class PlaceLinkBoxComponent {
  private readonly resolver = inject(PLACE_LINK_RESOLVER);
  private readonly search = inject(PLACE_SEARCH);

  readonly picked = output<PlaceCandidate>();
  readonly open = signal(false);
  readonly url = signal('');
  readonly working = signal(false);
  readonly error = signal<string | null>(null);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('linkInput');

  toggle(): void {
    this.open.update((v) => !v);
    this.error.set(null);
    if (this.open()) queueMicrotask(() => this.input()?.nativeElement.focus());
  }

  /** 누를 때만 클립보드를 읽는다. 읽지 못하면 입력칸에 직접 붙여 넣으면 된다(오류로 보지 않는다). */
  async paste(): Promise<void> {
    try {
      const text = (await navigator.clipboard?.readText())?.trim();
      if (text) {
        this.url.set(text);
        this.error.set(null);
        return;
      }
    } catch {
      // 권한 거부·지원하지 않는 브라우저
    }
    this.input()?.nativeElement.focus();
  }

  async find(): Promise<void> {
    const url = this.url().trim();
    if (this.working() || !url) return;
    if (!linkProvider(url)) {
      this.error.set(linkErrorMessage('unsupported_url'));
      return;
    }
    this.working.set(true);
    this.error.set(null);
    try {
      const linked = await this.resolver.resolve(url);
      // 카카오에 같은 곳이 있으면 지금 검색과 같은 출처로 담는다. 검색이 실패해도 링크의 값으로 담는다.
      const nearby = await this.search
        .search(linked.name, { near: { lat: linked.lat, lng: linked.lng }, radius: NEAR_RADIUS })
        .catch(() => null);
      this.picked.emit(matchLinkedPlace(linked, nearby?.candidates ?? []) ?? linked);
      this.url.set('');
      this.open.set(false);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : linkErrorMessage(''));
    } finally {
      this.working.set(false);
    }
  }
}
