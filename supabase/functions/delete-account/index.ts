import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { createDeleteAccountHandler } from "./handler.ts";

// These secrets are supplied by the Supabase Edge runtime, never by the browser.
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(
  createDeleteAccountHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user;
    },
    async deleteUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id, false);
      if (error) throw error;
    },
  }),
);
