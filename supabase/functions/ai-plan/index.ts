import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createAiPlanHandler } from './handler.ts';
import { RESPONSE_SCHEMA } from './prompt.ts';

/**
 * 이 비밀값들은 Supabase Edge 런타임이 넣는다. 브라우저는 볼 수 없다.
 * GEMINI_API_KEY는 `npx supabase secrets set`으로 등록한다.
 */
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

Deno.serve(
  createAiPlanHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user;
    },
    async callModel({ system, user }) {
      const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
        method: 'POST',
        // 키를 주소에 넣으면 서버 기록에 남는다. 헤더로 보낸다.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      });
      // 하루 한도 초과는 사용자가 할 수 있는 일이 달라 따로 구분한다.
      if (res.status === 429) throw new Error('quota_exceeded');
      if (!res.ok) throw new Error(`model_error_${res.status}`);
      const body = await res.json();
      return body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    },
  }),
);
