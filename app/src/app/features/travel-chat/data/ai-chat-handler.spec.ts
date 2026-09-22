import { describe, expect, it, vi } from 'vitest';
import { createAiChatHandler } from '../../../../../../supabase/functions/ai-chat/handler';
const body = {input:'카페 투어 코스 추천해줘',scope:'list',history:[],trip:null};
const post = (value: unknown, auth = true) => new Request('https://example.test/ai-chat',{method:'POST',headers:auth?{authorization:'Bearer token'}:{},body:JSON.stringify(value)});
describe('ai-chat handler', () => {
  it('requires authentication and validates input before calling the model', async () => {
    const callModel = vi.fn(async ()=>'{}');
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel});
    expect((await handler(post(body,false))).status).toBe(401);
    expect((await handler(post({...body,input:'x'.repeat(4001)}))).status).toBe(400);
    expect(callModel).not.toHaveBeenCalled();
  });
  it('returns validated model output with conversation context', async () => {
    const callModel = vi.fn(async ()=>JSON.stringify({kind:'explore',text:'어느 지역으로 갈까요?'}));
    const handler = createAiChatHandler({getUser:async()=>({id:'u'}),callModel});
    const result = await handler(post(body));
    expect(result.status).toBe(200);
    expect(JSON.parse((await result.json()).content).text).toContain('어느 지역');
    expect(callModel.mock.calls[0][0].user).toContain(body.input);
  });
  it('maps upstream quota and invalid output to errors', async () => {
    for (const [error,status] of [['quota_exceeded',429],['generation_failed',502]] as const) {
      const handler=createAiChatHandler({getUser:async()=>({id:'u'}),callModel:async()=>{throw new Error(error);}});
      expect((await handler(post(body))).status).toBe(status);
    }
  });
});
