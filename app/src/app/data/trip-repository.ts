import { InjectionToken } from '@angular/core';
import type { Trip } from '../domain/model';

/**
 * 화면은 이 인터페이스만 사용한다. 알파는 localStorage 구현을 쓰고,
 * Supabase 연결 단계에서 같은 인터페이스의 서버 구현으로 교체한다.
 */
export interface TripRepository {
  list(): Promise<Trip[]>;
  get(id: string): Promise<Trip | null>;
  save(trip: Trip): Promise<void>;
  remove(id: string): Promise<void>;
  /** 마지막 읽기에서 손상되어 건너뛴 항목 수 */
  readonly lastSkippedCount: number;
}

export const TRIP_REPOSITORY = new InjectionToken<TripRepository>('TRIP_REPOSITORY');
