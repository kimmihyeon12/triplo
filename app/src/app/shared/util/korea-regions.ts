/**
 * 국내 여행 지역 목록. 광역시·도와 그 아래 시·군을 담는다.
 *
 * 고정 목록을 쓰는 이유는 지명만 정확히 받기 위해서다. 자유 입력은 오타와
 * 표기 흔들림('강릉'/'강릉시'/'강릉 시')을 막을 수 없고, 장소 검색은 상호까지
 * 섞여 나와 지역 단위와 맞지 않는다.
 *
 * 행정구역이 바뀌면 이 파일을 고친다. 2026-09 기준이다.
 */
export interface KoreaRegion {
  /** 표시할 이름. 중복되는 시·군은 상위 지역을 붙여 구분한다. */
  readonly name: string;
  /** 검색에 쓰는 정식 상위 지역. 예: 강원특별자치도 */
  readonly province: string;
  /** 후보 목록에 붙이는 짧은 표기. 예: 강원 */
  readonly short: string;
  /**
   * 집계에 쓰는 고정 키. 예: 'gangwon-gangneung'
   *
   * 표시 이름 대신 코드를 쓰는 이유는 두 가지다. 지명이 바뀌어도 과거 기록이
   * 끊기지 않고, '광주(경기)'처럼 화면에서 구분하려고 붙인 괄호가 키에
   * 섞이지 않는다.
   */
  readonly code: string;
  /** 시·도 코드. code의 앞부분과 같다. 예: 'gangwon' */
  readonly provinceCode: string;
}

/**
 * 후보 옆에 붙일 짧은 이름. '강원특별자치도'처럼 긴 정식 명칭은 지명보다
 * 길어져 정작 봐야 할 지명이 묻힌다. 통용되는 두 글자 약칭으로 줄인다.
 */
const SHORT_PROVINCE: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

/** 시·도별 시·군 목록. 값은 표시 이름 그대로 쓴다. */
const BY_PROVINCE: Record<string, readonly string[]> = {
  서울특별시: ['서울'],
  부산광역시: ['부산'],
  대구광역시: ['대구'],
  인천광역시: ['인천', '강화', '옹진'],
  광주광역시: ['광주'],
  대전광역시: ['대전'],
  울산광역시: ['울산'],
  세종특별자치시: ['세종'],
  경기도: [
    '수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택',
    '의정부', '시흥', '파주', '광명', '김포', '군포', '광주(경기)', '이천', '양주', '오산',
    '구리', '안성', '포천', '의왕', '하남', '여주', '동두천', '과천', '양평', '가평', '연천',
  ],
  강원특별자치도: [
    '춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월',
    '평창', '정선', '철원', '화천', '양구', '인제', '고성(강원)', '양양',
  ],
  충청북도: [
    '청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양',
  ],
  충청남도: [
    '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여',
    '서천', '청양', '홍성', '예산', '태안',
  ],
  전북특별자치도: [
    '전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수',
    '임실', '순창', '고창', '부안',
  ],
  전라남도: [
    '목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성',
    '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도',
    '진도', '신안',
  ],
  경상북도: [
    '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산',
    '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화',
    '울진', '울릉',
  ],
  경상남도: [
    '창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안',
    '창녕', '고성(경남)', '남해', '하동', '산청', '함양', '거창', '합천',
  ],
  제주특별자치도: ['제주', '서귀포'],
};

/** 시·도 코드. 정식 명칭을 키로 쓴다. */
const PROVINCE_CODE: Record<string, string> = {
  서울특별시: 'seoul',
  부산광역시: 'busan',
  대구광역시: 'daegu',
  인천광역시: 'incheon',
  광주광역시: 'gwangju',
  대전광역시: 'daejeon',
  울산광역시: 'ulsan',
  세종특별자치시: 'sejong',
  경기도: 'gyeonggi',
  강원특별자치도: 'gangwon',
  충청북도: 'chungbuk',
  충청남도: 'chungnam',
  전북특별자치도: 'jeonbuk',
  전라남도: 'jeonnam',
  경상북도: 'gyeongbuk',
  경상남도: 'gyeongnam',
  제주특별자치도: 'jeju',
};

/**
 * 시·군 이름의 로마자 표기. 표시 이름에서 구분용 괄호를 뗀 값을 키로 쓴다.
 * 같은 지명이 여러 도에 있어도 코드는 시·도 코드와 합쳐져 겹치지 않는다.
 */
const CITY_ROMAN: Record<string, string> = {
  서울: 'seoul', 부산: 'busan', 대구: 'daegu', 인천: 'incheon', 광주: 'gwangju',
  대전: 'daejeon', 울산: 'ulsan', 세종: 'sejong', 강화: 'ganghwa', 옹진: 'ongjin',
  수원: 'suwon', 성남: 'seongnam', 고양: 'goyang', 용인: 'yongin', 부천: 'bucheon',
  안산: 'ansan', 안양: 'anyang', 남양주: 'namyangju', 화성: 'hwaseong', 평택: 'pyeongtaek',
  의정부: 'uijeongbu', 시흥: 'siheung', 파주: 'paju', 광명: 'gwangmyeong', 김포: 'gimpo',
  군포: 'gunpo', 이천: 'icheon', 양주: 'yangju', 오산: 'osan', 구리: 'guri',
  안성: 'anseong', 포천: 'pocheon', 의왕: 'uiwang', 하남: 'hanam', 여주: 'yeoju',
  동두천: 'dongducheon', 과천: 'gwacheon', 양평: 'yangpyeong', 가평: 'gapyeong', 연천: 'yeoncheon',
  춘천: 'chuncheon', 원주: 'wonju', 강릉: 'gangneung', 동해: 'donghae', 태백: 'taebaek',
  속초: 'sokcho', 삼척: 'samcheok', 홍천: 'hongcheon', 횡성: 'hoengseong', 영월: 'yeongwol',
  평창: 'pyeongchang', 정선: 'jeongseon', 철원: 'cheorwon', 화천: 'hwacheon', 양구: 'yanggu',
  인제: 'inje', 고성: 'goseong', 양양: 'yangyang',
  청주: 'cheongju', 충주: 'chungju', 제천: 'jecheon', 보은: 'boeun', 옥천: 'okcheon',
  영동: 'yeongdong', 증평: 'jeungpyeong', 진천: 'jincheon', 괴산: 'goesan', 음성: 'eumseong',
  단양: 'danyang',
  천안: 'cheonan', 공주: 'gongju', 보령: 'boryeong', 아산: 'asan', 서산: 'seosan',
  논산: 'nonsan', 계룡: 'gyeryong', 당진: 'dangjin', 금산: 'geumsan', 부여: 'buyeo',
  서천: 'seocheon', 청양: 'cheongyang', 홍성: 'hongseong', 예산: 'yesan', 태안: 'taean',
  전주: 'jeonju', 군산: 'gunsan', 익산: 'iksan', 정읍: 'jeongeup', 남원: 'namwon',
  김제: 'gimje', 완주: 'wanju', 진안: 'jinan', 무주: 'muju', 장수: 'jangsu',
  임실: 'imsil', 순창: 'sunchang', 고창: 'gochang', 부안: 'buan',
  목포: 'mokpo', 여수: 'yeosu', 순천: 'suncheon', 나주: 'naju', 광양: 'gwangyang',
  담양: 'damyang', 곡성: 'gokseong', 구례: 'gurye', 고흥: 'goheung', 보성: 'boseong',
  화순: 'hwasun', 장흥: 'jangheung', 강진: 'gangjin', 해남: 'haenam', 영암: 'yeongam',
  무안: 'muan', 함평: 'hampyeong', 영광: 'yeonggwang', 장성: 'jangseong', 완도: 'wando',
  진도: 'jindo', 신안: 'sinan',
  포항: 'pohang', 경주: 'gyeongju', 김천: 'gimcheon', 안동: 'andong', 구미: 'gumi',
  영주: 'yeongju', 영천: 'yeongcheon', 상주: 'sangju', 문경: 'mungyeong', 경산: 'gyeongsan',
  의성: 'uiseong', 청송: 'cheongsong', 영양: 'yeongyang', 영덕: 'yeongdeok', 청도: 'cheongdo',
  고령: 'goryeong', 성주: 'seongju', 칠곡: 'chilgok', 예천: 'yecheon', 봉화: 'bonghwa',
  울진: 'uljin', 울릉: 'ulleung',
  창원: 'changwon', 진주: 'jinju', 통영: 'tongyeong', 사천: 'sacheon', 김해: 'gimhae',
  밀양: 'miryang', 거제: 'geoje', 양산: 'yangsan', 의령: 'uiryeong', 함안: 'haman',
  창녕: 'changnyeong', 남해: 'namhae', 하동: 'hadong', 산청: 'sancheong', 함양: 'hamyang',
  거창: 'geochang', 합천: 'hapcheon',
  제주: 'jeju', 서귀포: 'seogwipo',
};

/** 표시 이름에서 구분용 괄호를 뗀다. '광주(경기)' → '광주' */
function bareName(name: string): string {
  return name.replace(/\(.*\)$/, '');
}

/** 검색·선택에 쓰는 평평한 목록. */
export const KOREA_REGIONS: readonly KoreaRegion[] = Object.entries(BY_PROVINCE).flatMap(
  ([province, names]) =>
    names.map((name) => {
      const provinceCode = PROVINCE_CODE[province] ?? province;
      const city = CITY_ROMAN[bareName(name)] ?? bareName(name);
      return {
        name,
        province,
        short: SHORT_PROVINCE[province] ?? province,
        code: `${provinceCode}-${city}`,
        provinceCode,
      };
    }),
);

const BY_CODE = new Map(KOREA_REGIONS.map((r) => [r.code, r]));
const BY_NAME = new Map(KOREA_REGIONS.map((r) => [r.name, r]));

/** 코드로 지역을 찾는다. 없으면 null. */
export function findRegionByCode(code: string): KoreaRegion | null {
  return BY_CODE.get(code) ?? null;
}

/**
 * 표시 이름으로 지역을 찾는다. 없으면 null.
 *
 * 코드를 갖지 않은 예전 여행을 집계할 때 쓴다. 지역 이름은 이 고정 목록에서
 * 고른 값이므로 대부분 찾아진다.
 */
export function findRegionByName(name: string): KoreaRegion | null {
  return BY_NAME.get(name.trim()) ?? null;
}

/** 지역 코드에서 시·도 코드를 뗀다. 'gangwon-gangneung' → 'gangwon' */
export function provinceCodeOf(code: string): string {
  const cut = code.indexOf('-');
  return cut === -1 ? code : code.slice(0, cut);
}

/** 시·도 코드에 붙일 짧은 이름. 지도 라벨과 통계 집계가 같은 표를 쓴다. */
export const PROVINCE_SHORT_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(PROVINCE_CODE).map(([province, code]) => [code, SHORT_PROVINCE[province]]),
);

/**
 * 입력한 글자로 지역을 찾는다. 세 단계로 나누어 담는다.
 *
 * 1. 지명이 그 글자로 시작하는 곳: '강' → 강릉, 강진, 강화
 * 2. 지명 안에 그 글자가 들어 있는 곳: '천' → 춘천, 이천
 * 3. 도 이름이 걸린 곳: '강원' → 강원도 시·군 전체
 *
 * 도 이름은 맨 뒤에 둔다. 앞에 섞으면 '강'을 쳤을 때 이름에 '강'이 없는
 * 춘천·원주가 위로 올라와 무엇을 찾았는지 알기 어렵다.
 */
export function searchRegions(query: string, limit = 8): readonly KoreaRegion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: KoreaRegion[] = [];
  const contains: KoreaRegion[] = [];
  const byProvince: KoreaRegion[] = [];
  for (const region of KOREA_REGIONS) {
    // 구분용 괄호('고성(강원)')는 검색 대상이 아니다. '강'을 쳤을 때
    // 이름에 '강'이 없는 고성이 끼어들면 안 된다.
    const name = region.name.replace(/\(.*\)$/, '').toLowerCase();
    if (name.startsWith(q)) starts.push(region);
    else if (name.includes(q)) contains.push(region);
    else if (region.province.toLowerCase().includes(q) || region.short.toLowerCase().includes(q))
      byProvince.push(region);
  }
  return [...starts, ...contains, ...byProvince].slice(0, limit);
}
