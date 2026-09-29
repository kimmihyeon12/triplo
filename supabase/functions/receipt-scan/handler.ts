import { systemPrompt } from './prompt.ts';
import { UserLimitError } from '../_shared/quota.ts';

/**
 * 사진으로 지출 입력. 브라우저가 모델을 직접 부르지 않고 이 함수를 거친다.
 * 모델 키와 지시문은 서버에만 있다. 브라우저가 고르는 것은 사진과
 * 형광펜을 칠했는지 여부뿐이다.
 *
 * 사진은 모델에 넘기기만 하고 어디에도 남기지 않는다. 여행 기록은 기본
 * 비공개이고, 영수증에는 카드 번호 일부 같은 개인 정보가 찍혀 있다.
 */

export interface ReceiptScanInput {
  /** base64 본문. data: 머리말은 붙이지 않는다. */
  image: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  highlighted: boolean;
}

export interface ReceiptScanDeps {
  getUser(token: string): Promise<{ id: string } | null>;
  /** 모델을 부르고 응답 본문(JSON 문자열)을 돌려준다. */
  callModel(request: { system: string; image: string; mimeType: string }): Promise<string>;
  /** 오늘 한 번을 차감하고 남은 횟수를 돌려준다. 한도를 넘으면 UserLimitError. */
  consumeQuota(userId: string): Promise<number>;
  /** 모델 호출이 실패했을 때 차감한 한 번을 돌려준다. */
  refundQuota(userId: string): Promise<void>;
}

/**
 * base64 길이 한도. 브라우저가 긴 변 1600px JPEG로 줄여 보내므로 보통
 * 1MB 안팎이다. 줄이지 않은 원본이 그대로 오면 거절한다.
 */
export const MAX_IMAGE_CHARS = 6_000_000;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createReceiptScanHandler(deps: ReceiptScanDeps) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers });

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'authentication_required' });

    try {
      const user = await deps.getUser(token);
      if (!user) return reply(401, { error: 'authentication_required' });

      const body = (await request.json().catch(() => null)) as Partial<ReceiptScanInput> | null;
      if (typeof body?.image === 'string' && body.image.length > MAX_IMAGE_CHARS)
        return reply(413, { error: 'image_too_large' });
      const input = validate(body);
      if (!input) return reply(400, { error: 'invalid_request' });

      // 검증을 통과한 사진만 센다. 모델이 실패하면 되돌린다.
      const remaining = await deps.consumeQuota(user.id);
      let content: string;
      try {
        content = await deps.callModel({
          system: systemPrompt(input.highlighted),
          image: input.image,
          mimeType: input.mimeType,
        });
      } catch (error) {
        await deps.refundQuota(user.id).catch(() => {});
        throw error;
      }
      return reply(200, { content, remaining });
    } catch (error) {
      if (error instanceof UserLimitError)
        return reply(429, { error: 'user_limit', limit: error.limit });
      if (error instanceof Error && error.message === 'quota_check_failed')
        return reply(503, { error: 'server_unavailable' });
      if (error instanceof Error && error.message === 'quota_exceeded')
        return reply(429, { error: 'quota_exceeded' });
      return reply(500, { error: 'scan_failed' });
    }
  };
}

function validate(body: Partial<ReceiptScanInput> | null): ReceiptScanInput | null {
  if (!body || typeof body.image !== 'string' || !body.image) return null;
  if (!/^[A-Za-z0-9+/]+=*$/.test(body.image)) return null;
  if (typeof body.mimeType !== 'string' || !MIME_TYPES.has(body.mimeType)) return null;
  return { image: body.image, mimeType: body.mimeType, highlighted: body.highlighted === true };
}
