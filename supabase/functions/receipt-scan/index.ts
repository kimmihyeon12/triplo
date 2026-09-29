import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createReceiptScanHandler } from './handler.ts';
import { RESPONSE_SCHEMA } from './prompt.ts';

/**
 * ai-plan과 같은 키·모델 설정을 쓴다. 이미지 입력은 같은 generateContent에
 * inlineData로 넣는다.
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
  createReceiptScanHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user;
    },
    async callModel({ system, image, mimeType }) {
      const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: image } },
                { text: '이 사진의 결제 항목을 읽어 줘.' },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      });
      if (res.status === 429) throw new Error('quota_exceeded');
      if (!res.ok) throw new Error(`model_error_${res.status}`);
      const body = await res.json();
      return body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    },
  }),
);
