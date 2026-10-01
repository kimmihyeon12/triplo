import { DEFAULT_SETTINGS, type DeviceState, type NotificationSettings } from '../model/notifications';
import type { PushRepository } from './push-repository';

/** 기기 저장의 최소 모양. 시험에서는 메모리로 바꾼다. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * 테스트 앱·미리보기용. 실제 구독 없이 켬·끔과 설정을 기기에 남긴다.
 * 테스트는 상태 열쇠에 'denied'·'install-required'를 넣어 그 화면을 확인한다.
 */
export class LocalPushRepository implements PushRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string | (() => string),
  ) {}

  private get prefix(): string {
    return typeof this.key === 'function' ? this.key() : this.key;
  }

  async deviceState(): Promise<DeviceState> {
    const value = this.storage.getItem(`${this.prefix}.device`);
    return value === 'on' || value === 'denied' || value === 'install-required' || value === 'unsupported' ? value : 'off';
  }

  async enable(): Promise<DeviceState> {
    const state = await this.deviceState();
    if (state !== 'off') return state;
    this.storage.setItem(`${this.prefix}.device`, 'on');
    return 'on';
  }

  async disable(): Promise<DeviceState> {
    if ((await this.deviceState()) === 'on') this.storage.setItem(`${this.prefix}.device`, 'off');
    return this.deviceState();
  }

  async settings(): Promise<NotificationSettings> {
    try {
      const raw = this.storage.getItem(`${this.prefix}.settings`);
      return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NotificationSettings>) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: NotificationSettings): Promise<void> {
    this.storage.setItem(`${this.prefix}.settings`, JSON.stringify(settings));
  }
}
