import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiMapLink } from '../../../../shared/ui/map-link/map-link';

/**
 * 네이버지도·카카오맵으로 여는 아이콘 링크 한 쌍.
 *
 * 여행 상세의 장소·숙소 행, 숙소 탭, AI 결과가 같은 마크업을 네 번 반복해 모양·접근성
 * 수정을 한곳만 고치기 쉬웠다(리팩터링 제안 C4). 어디를 검색할지(주소가 없으면 지역으로
 * 찾는 규칙 등)는 부르는 쪽이 정해 주소로 넘긴다. 배치는 부르는 쪽 감싸개가 정하도록
 * 이 요소 자체는 상자를 만들지 않는다(display: contents).
 *
 * 아이콘은 각 사가 배포하는 공식 서비스 아이콘을 원본 그대로 쓴다. 보이는 크기는
 * 26px이고 누르는 영역은 가상 요소로 44px을 확보한다.
 */
@Component({
  selector: 'app-map-links',
  imports: [UiMapLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './map-links.html',
})
export class UiMapLinks {
  /** 화면 읽기에 붙일 이름. 예: '경포대' → '경포대 네이버지도에서 검색'. */
  readonly name = input.required<string>();
  readonly naverHref = input.required<string>();
  readonly kakaoHref = input.required<string>();
  /** 테스트에서 링크를 찾을 id. 없으면 붙이지 않는다. */
  readonly naverTestId = input<string | null>(null);
  readonly kakaoTestId = input<string | null>(null);
}
