import { findRegionByName, provinceCodeByName } from '../../../shared/util/korea-regions';

/** 낱말 끝의 조사. '강릉으로'·'부산에서'를 지역 이름만 남긴다. */
const PARTICLE = /(으로|에서|이랑|랑|하고|에|로|은|는|이|가|을|를|의|도|만)$/;

/**
 * 질문에서 국내 지역 이름을 읽는다(최대 두 곳). 장소 후보를 찾을 지역이다.
 * 시·도 이름('부산')은 그대로 쓴다. 지역 찾기가 시·도 이름에 첫 자치구를 돌려주기 때문이다.
 */
export function chatRegions(text: string): string[] {
  const found: string[] = [];
  for (const raw of text.split(/[\s,.!?~·]+/)) {
    const word = raw.replace(PARTICLE, '');
    if (word.length < 2) continue;
    const name = provinceCodeByName(word) ? word : findRegionByName(word)?.name;
    if (name && !found.includes(name)) found.push(name);
    if (found.length === 2) break;
  }
  return found;
}
