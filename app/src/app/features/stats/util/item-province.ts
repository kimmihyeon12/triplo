import { findRegionByName, provinceCodeOf } from '../../../shared/util/korea-regions';
import type { TripRegion } from '../../trips/model/trip';
import { provinceCodeForAddress } from './province-match';

/**
 * 장소 하나가 실제로 속한 시·도를 정한다.
 *
 * 저장된 주소를 먼저 읽고, 읽지 못할 때만 여행에 담긴 지역을 쓴다.
 *
 * 순서를 이렇게 두는 까닭은 둘이 가리키는 것이 다르기 때문이다. 여행 지역은
 * 사용자가 여행 전체에 붙인 이름표이고, 주소는 그 장소 하나의 실제 위치다.
 * '광주 주말 여행'에 구례와 함평을 담으면 세 장소가 모두 여행 지역 '광주'를
 * 가리키므로, 여행 지역을 먼저 쓰면 전남에 다녀온 기록이 광주광역시로
 * 집계되어 전남에는 색이 칠해지지 않는다(2026-09-22 확인).
 *
 * 주소는 장소 검색에서 고른 검증된 값이므로 이것을 우선해도 없는 값을
 * 지어내는 것이 아니다. 주소가 비어 있거나 어느 시·도로도 읽히지 않으면
 * 여행 지역으로 되돌아가며, 둘 다 실패하면 null이다.
 */
export function itemProvinceCode(address: string, region: TripRegion | null): string | null {
  const byAddress = provinceCodeForAddress(address);
  if (byAddress) return byAddress;

  const resolved = resolveRegion(region);
  // 전국 격자는 시·도 단위다. '강릉'과 '속초'는 함께 '강원'으로 센다.
  return resolved ? provinceCodeOf(resolved.code) : null;
}

/**
 * 여행의 지역을 표준 지역 코드로 바꾼다.
 *
 * 저장된 코드를 먼저 쓰고, 없으면 이름으로 찾는다. 이름은 고정 목록에서 고른
 * 값이므로 대부분 찾아진다. 둘 다 실패하면 null이다.
 */
export function resolveRegion(region: TripRegion | null): { code: string; name: string } | null {
  if (!region) return null;
  if (region.regionCode) return { code: region.regionCode, name: region.name };
  const found = findRegionByName(region.name);
  return found ? { code: found.code, name: found.name } : null;
}
