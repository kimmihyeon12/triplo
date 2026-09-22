import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createAiChatHandler } from './handler.ts';
import { RESPONSE_SCHEMA } from './prompt.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const key = Deno.env.get('GEMINI_API_KEY') ?? '';
const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';

Deno.serve(createAiChatHandler({
  async getUser(token) {
    const {data,error} = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  async callModel({system,user}) {
    if (!key) throw new Error('server_unavailable');
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
        signal:AbortSignal.timeout(45000),
        body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{responseMimeType:'application/json',responseSchema:RESPONSE_SCHEMA}}),
      });
    } catch (error) {
      if (error instanceof DOMException && ['TimeoutError','AbortError'].includes(error.name)) throw new Error('model_timeout');
      throw error;
    }
    if (response.status === 429) throw new Error('quota_exceeded');
    if (!response.ok) throw new Error('generation_failed');
    const body = await response.json();
    return body?.candidates?.[0]?.content?.parts?.map((part: {text?:string})=>part.text ?? '').join('') ?? '';
  },
}));
