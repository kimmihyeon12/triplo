import { normalizeChatResponse } from './contract.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { UserLimitError } from '../_shared/quota.ts';

export interface ChatDeps {
  getUser(token: string): Promise<{id: string} | null>;
  callModel(prompt: {system: string; user: string}): Promise<string>;
  /** 오늘 한 번을 차감하고 남은 횟수를 돌려준다. 한도를 넘으면 UserLimitError. */
  consumeQuota(userId: string): Promise<number>;
  /** 모델 호출이 실패했을 때 차감한 한 번을 돌려준다. */
  refundQuota(userId: string): Promise<void>;
}

function validate(value: unknown): object | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const boundedText = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
  if (!boundedText(body.input, 4000) || !['list','trip'].includes(String(body.scope)) || !Array.isArray(body.history) || body.history.length > 10) return null;
  const history: {role:string;text:string}[] = [];
  for (const turn of body.history) {
    if (!turn || !['user','assistant'].includes(turn.role) || !boundedText(turn.text,6000)) return null;
    history.push({role:turn.role,text:turn.text});
  }
  let trip: object | null = null;
  if (body.trip !== null && body.trip !== undefined) {
    const t = body.trip as Record<string, unknown>;
    if (typeof t !== 'object' || !boundedText(t.title,200) || !Array.isArray(t.regions) || t.regions.length > 20 || !t.regions.every(r=>boundedText(r,80)) || !Number.isInteger(t.dayCount) || Number(t.dayCount) < 1 || Number(t.dayCount) > 30 || !Array.isArray(t.days) || t.days.length > 30 || !Array.isArray(t.unassigned) || t.unassigned.length > 100 || !t.unassigned.every(n=>boundedText(n,120))) return null;
    const days: {day:number;names:string[]}[] = [];
    for (const day of t.days) {
      if (!day || !Number.isInteger(day.day) || day.day < 1 || day.day > Number(t.dayCount) || !Array.isArray(day.names) || day.names.length > 100 || !day.names.every((n: unknown)=>boundedText(n,120))) return null;
      days.push({day:day.day,names:day.names});
    }
    trip = {title:t.title, regions:t.regions, dayCount:t.dayCount, days, unassigned:t.unassigned};
  }
  return {input:body.input,scope:body.scope,history,trip};
}

export function createAiChatHandler(deps: ChatDeps) {
  const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
  const reply = (status: number, body: object) => new Response(JSON.stringify(body),{status,headers});
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return reply(405,{error:'method_not_allowed'});
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401,{error:'authentication_required'});
    try {
      const user = await deps.getUser(token);
      if (!user) return reply(401,{error:'authentication_required'});
      const raw = await request.text();
      if (raw.length > 80000) return reply(400,{error:'invalid_request'});
      let input: object | null;
      try { input = validate(JSON.parse(raw)); } catch { input = null; }
      if (!input) return reply(400,{error:'invalid_request'});
      // 검증을 통과한 질문만 센다. 모델이 실패하거나 쓸 수 없는 답을 주면 되돌린다.
      const remaining = await deps.consumeQuota(user.id);
      let result;
      try {
        result = normalizeChatResponse(await deps.callModel({system:SYSTEM_PROMPT,user:JSON.stringify(input)}));
      } catch (error) {
        await deps.refundQuota(user.id).catch(()=>{});
        throw error;
      }
      return reply(200,{content:JSON.stringify(result),remaining});
    } catch (error) {
      if (error instanceof UserLimitError) return reply(429,{error:'user_limit',limit:error.limit});
      const code = error instanceof Error ? error.message : '';
      if (code === 'quota_check_failed') return reply(503,{error:'server_unavailable'});
      if (code === 'quota_exceeded') return reply(429,{error:code});
      if (code === 'server_unavailable') return reply(503,{error:code});
      if (code === 'model_timeout') return reply(504,{error:code});
      return reply(502,{error:'generation_failed'});
    }
  };
}
