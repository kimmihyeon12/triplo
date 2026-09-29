import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeCode } from './invite-code';
import {
  INVITE_INVALID_MESSAGE,
  type InvitePreview,
  type TripMembersRepository,
} from './trip-members-repository';

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface MembersDataClient {
  call(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  inviteExpiry(tripId: string): Promise<string | null>;
}

export function supabaseMembersDataClient(client: () => Promise<SupabaseClient>): MembersDataClient {
  return {
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      return { data, error };
    },
    async inviteExpiry(tripId) {
      const { data } = await (await client())
        .from('trip_invites')
        .select('expires_at')
        .eq('trip_id', tripId)
        .maybeSingle();
      return (data as { expires_at: string } | null)?.expires_at ?? null;
    },
  };
}

/** 서버 함수의 오류 코드를 사용자가 읽을 문장으로 바꾼다. */
function toMembersError(error: { code?: string; message?: string }): Error {
  if (error.message === 'invite_invalid') return new Error(INVITE_INVALID_MESSAGE);
  if (error.code === '28000') return new Error('로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.');
  if (error.code === 'P0422') return new Error('여행을 만든 사람은 나갈 수 없어요. 여행을 지워 주세요.');
  if (error.code === 'P0404') return new Error('권한이 없거나 이미 없어진 여행이에요.');
  return new Error('처리하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
}

export class SupabaseTripMembers implements TripMembersRepository {
  constructor(private readonly data: MembersDataClient) {}

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.data.call(fn, args);
    if (error) throw toMembersError(error);
    return data as T;
  }

  createInvite(tripId: string): Promise<string> {
    return this.call('create_trip_invite', { p_trip_id: tripId });
  }

  async revokeInvite(tripId: string): Promise<void> {
    await this.call('revoke_trip_invite', { p_trip_id: tripId });
  }

  inviteExpiry(tripId: string): Promise<string | null> {
    return this.data.inviteExpiry(tripId);
  }

  preview(code: string): Promise<InvitePreview> {
    return this.call('preview_trip_invite', { p_code: normalizeCode(code) });
  }

  join(code: string): Promise<string> {
    return this.call('join_trip', { p_code: normalizeCode(code) });
  }

  async leave(tripId: string): Promise<void> {
    await this.call('leave_trip', { p_trip_id: tripId });
  }

  async remove(tripId: string, userId: string): Promise<void> {
    await this.call('remove_trip_member', { p_trip_id: tripId, p_user_id: userId });
  }
}
