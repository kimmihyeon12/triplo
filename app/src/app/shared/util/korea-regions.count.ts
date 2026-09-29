/*
  이 파일은 scripts/build-region-data.mjs가 만든다. 직접 고치지 않는다.

  지역 목록 전체를 들이지 않고 개수만 필요한 자리를 위한 파일이다.
  숫자 하나를 얻으려고 korea-regions.data.ts를 가져오면 그 배열이 통째로
  같은 묶음에 들어간다.
*/

/** 시·군·구 개수. korea-regions.data.ts의 REGION_DATA 길이와 같다. */
export const REGION_COUNT = 230;
