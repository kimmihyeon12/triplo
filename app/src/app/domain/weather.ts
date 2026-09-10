import type { IsoDate } from './model';

/**
 * 날씨 표시용 최소 타입.
 * 실제 날씨 제공자는 아직 연결되지 않았으므로 지금은 모든 값이 'unknown'이다.
 * 추정한 날씨를 확정값처럼 표시하지 않는다(PRODUCT.md 원칙 2).
 */
export type WeatherCondition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'unknown';

export interface DailyWeather {
  readonly date: IsoDate;
  readonly condition: WeatherCondition;
  /** 섭씨. 미확인이면 null */
  readonly highC: number | null;
  readonly lowC: number | null;
}

/** 상태별 아이콘 이름(app-icon 세트). */
export const WEATHER_ICON: Record<WeatherCondition, string> = {
  clear: 'sun',
  'partly-cloudy': 'cloud-sun',
  cloudy: 'cloud',
  rain: 'rain',
  snow: 'snow',
  unknown: 'weather-unknown',
};

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  clear: '맑음',
  'partly-cloudy': '구름 조금',
  cloudy: '흐림',
  rain: '비',
  snow: '눈',
  unknown: '날씨 정보 없음',
};
