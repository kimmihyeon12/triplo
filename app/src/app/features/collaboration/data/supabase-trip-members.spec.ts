import { describe, expect, it, vi } from 'vitest';
import { SupabaseTripMembers, type MembersDataClient } from './supabase-trip-members';

function fake(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const client: MembersDataClient = {
    call: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    inviteExpiry: vi.fn(async () => '2026-10-06T00:00:00Z'),
  };
  return client;
}

describe('SupabaseTripMembers', () => {
  it('각 동작을 해당 서버 함수로 보낸다', async () => {
    const client = fake({ data: 'ABCDEFGH' });
    const members = new SupabaseTripMembers(client);
    expect(await members.createInvite('t1')).toBe('ABCDEFGH');
    await members.revokeInvite('t1');
    await members.leave('t1');
    await members.remove('t1', 'u2');
    await members.join('abcd-efgh');
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['create_trip_invite', { p_trip_id: 't1' }],
      ['revoke_trip_invite', { p_trip_id: 't1' }],
      ['leave_trip', { p_trip_id: 't1' }],
      ['remove_trip_member', { p_trip_id: 't1', p_user_id: 'u2' }],
      ['join_trip', { p_code: 'ABCDEFGH' }],
    ]);
    expect(await members.inviteExpiry('t1')).toBe('2026-10-06T00:00:00Z');
  });

  it('잘못된·만료·취소된 초대는 한 가지 문장으로 알린다', async () => {
    const members = new SupabaseTripMembers(fake({ error: { code: 'P0404', message: 'invite_invalid' } }));
    await expect(members.preview('AAAA-AAAA')).rejects.toThrow(
      '초대 링크가 올바르지 않거나 만료됐어요. 여행을 만든 친구에게 새 링크를 받아 주세요.',
    );
  });

  it('로그인 필요·주인 나가기·권한 없음을 구분한다', async () => {
    await expect(new SupabaseTripMembers(fake({ error: { code: '28000' } })).join('x')).rejects.toThrow('로그인');
    await expect(new SupabaseTripMembers(fake({ error: { code: 'P0422' } })).leave('t1')).rejects.toThrow(
      '여행을 만든 사람은 나갈 수 없어요',
    );
    await expect(new SupabaseTripMembers(fake({ error: { code: 'P0404' } })).remove('t1', 'u')).rejects.toThrow(
      '권한이 없거나',
    );
  });

  it('미리보기를 앱 모양으로 돌려준다', async () => {
    const preview = {
      title: '강릉',
      startDate: '2026-10-10',
      endDate: '2026-10-11',
      ownerNickname: '주인',
      regions: [{ id: 'r1', name: '강릉시', order: 0 }],
      stops: [{ name: '경포대', kind: 'place', date: '2026-10-10', order: 0, fixedTime: null, regionId: 'r1' }],
      stays: [{ name: '호텔', checkIn: '2026-10-10', checkOut: '2026-10-11' }],
    };
    const client = fake({ data: preview });
    expect(await new SupabaseTripMembers(client).preview('abcd-efgh')).toEqual(preview);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      'preview_trip_invite',
      { p_code: 'ABCDEFGH' },
    ]);
  });
});
