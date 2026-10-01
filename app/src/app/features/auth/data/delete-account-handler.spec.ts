import { describe, expect, it, vi } from 'vitest';
import { createDeleteAccountHandler } from '../../../../../../supabase/functions/delete-account/handler';

function setup(valid = true) {
  const getUser = vi.fn(async (_token: string) => (valid ? { id: 'current-user' } : null));
  const order: string[] = [];
  const deleteUser = vi.fn(async (_id: string) => {
    order.push('delete');
  });
  const handOverTrips = vi.fn(async (_id: string) => {
    order.push('handover');
  });
  return { getUser, deleteUser, handOverTrips, order, handler: createDeleteAccountHandler({ getUser, deleteUser, handOverTrips }) };
}

const request = (body: unknown = { confirmation: 'DELETE' }, token = 'valid-token') =>
  new Request('https://example.com/functions/v1/delete-account', {
    method: 'POST',
    headers: { authorization: token ? `Bearer ${token}` : '', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('account deletion authorization', () => {
  it('rejects missing credentials before deleting', async () => {
    const { handler, deleteUser } = setup();
    expect((await handler(request({}, ''))).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it('rejects invalid or expired user tokens', async () => {
    const { handler, deleteUser } = setup(false);
    expect((await handler(request())).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it('requires explicit deletion confirmation', async () => {
    const { handler, deleteUser } = setup();
    expect((await handler(request({}))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it('only deletes the authenticated caller, ignoring supplied user IDs', async () => {
    const { handler, deleteUser } = setup();
    expect((await handler(request({ confirmation: 'DELETE', userId: 'victim' }))).status).toBe(200);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith('current-user');
  });
  it('does not report success when the admin operation fails', async () => {
    const { handler, deleteUser } = setup();
    deleteUser.mockRejectedValueOnce(new Error('private database detail'));
    const response = await handler(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database detail');
  });
  it('함께 쓰는 여행을 먼저 넘긴 뒤 계정을 지운다', async () => {
    const { handler, handOverTrips, order } = setup();
    expect((await handler(request())).status).toBe(200);
    expect(handOverTrips).toHaveBeenCalledExactlyOnceWith('current-user');
    expect(order).toEqual(['handover', 'delete']);
  });
  it('넘기기에 실패하면 계정을 지우지 않는다(친구의 여행이 함께 사라지지 않게)', async () => {
    const { handler, handOverTrips, deleteUser } = setup();
    handOverTrips.mockRejectedValueOnce(new Error('db'));
    expect((await handler(request())).status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
