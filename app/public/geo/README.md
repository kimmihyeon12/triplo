# 경계 데이터

통계 지도가 읽는 GeoJSON을 둔다.

## 지금 들어 있는 것

`korea-provinces-2013.geo.json` 하나이며 통계청 2013 기준의 실제 시·도 경계다. `/stats`의 3D 지도가 이 파일만 읽는다. 상세는 아래 "실제 경계 추가" 절을 따른다.

초기에 화면 확인용으로 두었던 사각형 fixture 두 개(`skorea-provinces.geo.json`, `skorea-municipalities.geo.json`)는 실제 경계로 대체되어 2026-09-19에 삭제했다.

경계 파일과 속성 매핑은 `features/stats/feature/visit-map/visit-map.ts`를 따른다.

## 다른 출처를 쓸 때

| 출처 | 내용 | 조건 |
| --- | --- | --- |
| [GADM](https://gadm.org/download_country.html) | 시도·시군구 | 비상업 무료 |
| [Natural Earth](https://www.naturalearthdata.com/) | 국가 단위 | 퍼블릭 도메인 |
| [공공데이터포털](https://www.data.go.kr/) | 행정구역 | 공공누리 |

출처를 바꾸면 라이선스 표기와 이 문서를 함께 고친다.

## 용량

시도 경계는 원본이 수 MB다. 번들에 넣지 않고 이 폴더에 두는 이유이며, 지도 화면에 들어올 때만 받는다. 너무 크면 [mapshaper](https://mapshaper.org/)로 단순화한다. 복셀로 바꾸면서 어차피 격자 크기만큼 뭉개지므로 정밀도를 다 쓰지 않는다.

## 실제 경계 추가 (2026-09-18)

`korea-provinces-2013.geo.json`은 위 두 사각형 fixture와 별개인 실제 시·도 경계다. 현재 `/stats`의 3D 지도는 이 파일만 사용한다.

- 원본: https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json
- 제공 저장소: https://github.com/southkorea/southkorea-maps
- 기준: 통계청 2013, 단순화된 경계. 현재 행정구역과 차이가 있을 수 있다.
- 원본 JSON을 그대로 저장하며 좌표를 임의로 만들지 않는다.
- 라이선스: 저장소의 데이터 라이선스 안내를 따른다. 상단의 포괄적인 MIT 표기는 이 데이터의 라이선스 확인을 대체하지 않는다.
