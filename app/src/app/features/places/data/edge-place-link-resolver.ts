import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';
import type { LinkedPlace } from '../model/place-link';
import {
  linkErrorMessage,
  linkedToCandidate,
  type LinkedCandidate,
  type PlaceLinkResolver,
  type PlaceRating,
} from './place-link-resolver';

/** 서버 함수 resolve-place로 링크를 읽는다. 로그인 토큰은 클라이언트가 실어 보낸다. */
@Injectable({ providedIn: 'root' })
export class EdgePlaceLinkResolver implements PlaceLinkResolver {
  private readonly auth = inject(AuthStore);

  async resolve(url: string): Promise<LinkedCandidate> {
    try {
      return linkedToCandidate(await this.auth.callFunction<LinkedPlace>('resolve-place', { url }));
    } catch (error) {
      throw new Error(linkErrorMessage(error instanceof Error ? error.message : ''));
    }
  }

  async ratings(urls: readonly string[]): Promise<(PlaceRating | null)[]> {
    if (!urls.length) return [];
    const { ratings } = await this.auth.callFunction<{ ratings: (PlaceRating | null)[] }>('resolve-place', {
      ratings: urls.slice(0, 30),
    });
    return ratings;
  }
}
