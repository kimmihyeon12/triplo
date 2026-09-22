/**
 * 지역 목록의 자료형.
 *
 * 목록 데이터(`korea-regions.data.ts`)와 그것을 쓰는 코드
 * (`korea-regions.ts`)가 서로를 참조하지 않도록 자료형만 따로 둔다.
 */

export interface KoreaRegion {
  /**
   * 집계와 지도가 공유하는 키. 시·도 번호와 이름을 붙인다. 예: '12_여수시'
   *
   * 표시 이름 대신 코드를 쓰는 이유는 두 가지다. 지명이 바뀌어도 과거 기록이
   * 끊기지 않고, '중구(서울)'처럼 화면에서 구분하려고 붙인 괄호가 키에
   * 섞이지 않는다.
   */
  readonly code: string;
  /** 행정구역 이름. 예: '여수시', '종로구' */
  readonly name: string;
  /**
   * 화면에 적을 이름. 같은 이름이 여러 시·도에 있으면 시·도를 덧붙인다.
   * '중구'는 다섯 곳이라 '중구(서울)'로 적어야 어디인지 알 수 있다.
   */
  readonly label: string;
  /** 정식 시·도 이름. 예: '전남광주통합특별시' */
  readonly province: string;
  /** 시·도 번호. code의 앞부분과 같다. 예: '12' */
  readonly provinceCode: string;
  /** 후보 목록에 붙이는 짧은 표기. 예: '전남광주' */
  readonly short: string;
}

export interface KoreaProvince {
  /** 시·도 번호. 예: '12' */
  readonly code: string;
  /** 정식 이름. 예: '전남광주통합특별시' */
  readonly name: string;
  /** 짧은 표기. 예: '전남광주' */
  readonly short: string;
}
