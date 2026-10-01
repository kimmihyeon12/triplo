import { InjectionToken } from '@angular/core';
import type { DeviceState, NotificationSettings } from '../model/notifications';

/**
 * 알림 구독과 설정. 실행 앱은 서비스 워커 푸시 구독과 Supabase를, 테스트 앱과
 * 미리보기는 기기 저장을 쓴다(app.config).
 */
export interface PushRepository {
  /** 이 기기의 상태. */
  deviceState(): Promise<DeviceState>;
  /** 권한을 묻고 이 기기를 구독한다. 끝난 뒤의 상태를 돌려준다. */
  enable(): Promise<DeviceState>;
  /** 이 기기의 구독을 지운다. */
  disable(): Promise<DeviceState>;
  settings(): Promise<NotificationSettings>;
  saveSettings(settings: NotificationSettings): Promise<void>;
}

export const PUSH_REPOSITORY = new InjectionToken<PushRepository>('PUSH_REPOSITORY');
