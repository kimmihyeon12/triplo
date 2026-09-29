import { describe, expect, it, vi } from 'vitest';
import { createAiChatHandler } from '../../../../../../supabase/functions/ai-chat/handler';
import { UserLimitError } from '../../../../../../supabase/functions/_shared/quota';
const quota = (consume: () => Promise<number> = async () => 29) => ({
  consumeQuota: vi.fn(consume),
  refundQuota: vi.fn(async () => {}),
});
const body = {input:'카페 투어 코스 추천해줘',scope:'list',history:[],trip:null};
const post = (value: unknown, auth = true) => new Request('https://example.test/ai-chat',{method:'POST',headers:auth?{authorization:'Bearer token'}:{},body:JSON.stringify(value)});
describe('ai-chat handler', () => {
  it('requires authentication and validates input before calling the model', async () => {
    const callModel = vi.fn(async ()=>'{}');
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota()});
    expect((await handler(post(body,false))).status).toBe(401);
    expect((await handler(post({...body,input:'x'.repeat(4001)}))).status).toBe(400);
    expect(callModel).not.toHaveBeenCalled();
  });
  it('returns validated model output with conversation context', async () => {
    const callModel = vi.fn(async ()=>JSON.stringify({kind:'explore',text:'어느 지역으로 갈까요?'}));
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota()});
    const result = await handler(post(body));
    expect(result.status).toBe(200);
    expect(JSON.parse((await result.json()).content).text).toContain('어느 지역');
    expect(callModel.mock.calls[0][0].user).toContain(body.input);
  });
  it('maps upstream quota and invalid output to errors', async () => {
    for (const [error,status] of [['quota_exceeded',429],['generation_failed',502]] as const) {
      const handler=createAiChatHandler({getUser:async()=>({id:'u'}),callModel:async()=>{throw new Error(error);},...quota()});
      expect((await handler(post(body))).status).toBe(status);
    }
  });
  it('counts one use after validation and returns what is left', async () => {
    const q = quota();
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel:async()=>JSON.stringify({kind:'explore',text:'어디로 갈까요?'}),...q});
    expect((await handler(post({...body,input:''}))).status).toBe(400);
    expect(q.consumeQuota).not.toHaveBeenCalled();
    const ok = await handler(post(body));
    expect((await ok.json()).remaining).toBe(29);
    expect(q.consumeQuota).toHaveBeenCalledWith('u');
  });
  it('refuses over the personal limit without calling the model', async () => {
    const callModel = vi.fn(async ()=>'{}');
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota(async()=>{throw new UserLimitError(30);})});
    const res = await handler(post(body));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({error:'user_limit',limit:30});
    expect(callModel).not.toHaveBeenCalled();
  });
  it('refunds when the model fails or returns unusable output', async () => {
    for (const callModel of [async()=>{throw new Error('quota_exceeded');}, async()=>'not json']) {
      const q = quota();
      await createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...q})(post(body));
      expect(q.refundQuota).toHaveBeenCalledWith('u');
    }
  });
  it('fails closed when the quota check fails', async () => {
    const callModel = vi.fn(async ()=>'{}');
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel,...quota(async()=>{throw new Error('quota_check_failed');})});
    const res = await handler(post(body));
    expect(res.status).toBe(503);
    expect(callModel).not.toHaveBeenCalled();
  });
});
