export interface AccountAdmin {
  getUser(token: string): Promise<{ id: string } | null>;
  deleteUser(id: string): Promise<void>;
}

/** Never take the deletion target from the request: verify the bearer with Auth. */
export function createDeleteAccountHandler(admin: AccountAdmin) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply(405, { error: "method_not_allowed" });
    const token = /^Bearer\s+(\S+)$/i.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
    if (!token) return reply(401, { error: "authentication_required" });
    try {
      const user = await admin.getUser(token);
      if (!user) return reply(401, { error: "authentication_required" });
      const body = await request.json().catch(() => null);
      if (body?.confirmation !== "DELETE")
        return reply(400, { error: "confirmation_required" });
      await admin.deleteUser(user.id);
      return reply(200, { deleted: true });
    } catch {
      return reply(500, { error: "account_deletion_failed" });
    }
  };
}
