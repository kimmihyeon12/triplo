import { findRegionByCode, findRegionByName, isExactRegionName } from '../../../shared/util/korea-regions';
import type { TripRegion } from '../../trips/model/trip';
import { regionCodeForAddress } from './province-match';

/**
 * 장소 하나가 실제로 속한 시·군·구를 정한다.
 *
 * 저장된 주소를 먼저 읽고, 읽지 못할 때만 여행에 담긴 지역을 쓴다.
 *
 * 순서를 이렇게 두는 까닭은 둘이 가리키는 것이 다르기 때문이다. 여행 지역은
 * 사용자가 여행 전체에 붙인 이름표이고, 주소는 그 장소 하나의 실제 위치다.
 * '광주 주말 여행'에 구례와 함평을 담으면 세 장소가 모두 여행 지역 '광주'를
 * 가리키므로, 여행 지역을 먼저 쓰면 전남에 다녀온 기록이 광주로 집계되어
 * 전남에는 색이 칠해지지 않는다(2026-09-22 확인).
 *
 * 주소는 장소 검색에서 고른 검증된 값이므로 이것을 우선해도 없는 값을
 * 지어내는 것이 아니다. 주소가 비어 있거나 어느 지역으로도 읽히지 않으면
 * 여행 지역으로 되돌아가며, 둘 다 실패하면 null이다.
 */
export function itemRegionCode(address: string, region: TripRegion | null): string | null {
  const byAddress = regionCodeForAddress(address);
  if (byAddress) return byAddress;

  return resolveRegion(region)?.code ?? null;
}

/**
 * 여행의 지역을 표준 지역으로 바꾼다.
 *
 * 저장된 코드를 먼저 쓰고, 없으면 이름으로 찾는다. 이름은 고정 목록에서 고른
 * 값이므로 대부분 찾아진다. 둘 다 실패하면 null이다.
 *
 * 저장된 코드가 옛 형식일 수 있다. 2026-07-01 통합 전에는 지역 코드가
 * 'jeonnam-yeosu' 꼴이었고 그 코드는 지금 목록에 없다. 그때는 이름으로 다시
 * 찾아 새 코드를 얻는다.
 */
export function resolveRegion(region: TripRegion | null): { code: string; name: string } | null {
  if (!region) return null;
  if (region.regionCode) {
    const found = findRegionByCode(region.regionCode);
    if (found) return { code: found.code, name: found.name };
  }
  /*
    시·군·구를 정확히 가리키는 이름만 받는다. '서울'처럼 시·도 이름만 있으면
    어느 자치구인지 알 수 없는데, 그 시·도의 첫 지역을 골라 쓰면 주소 없는
    장소가 모두 강남구에 다녀온 것으로 표시된다(2026-09-22 확인). 모르는 것은
    분류되지 않음으로 남기는 편이 정확하다.
  */
  if (!isExactRegionName(region.name)) return null;
  const byName = findRegionByName(region.name);
  return byName ? { code: byName.code, name: byName.name } : null;
}
