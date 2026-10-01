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

describe('ai-chat 실제 장소 후보', () => {
  const candidates = [
    { id: 'c1', name: '테라로사 커피공장', kind: 'break', category: '카페', area: '강릉시 구정면' },
    { id: 'c2', name: '초당순두부마을', kind: 'meal', category: '음식점', area: '강릉시 초당동' },
  ];
  it('후보를 받으면 후보 전용 지시문으로 부르고, 답의 번호를 후보 이름으로 바꾼다', async () => {
    const callModel = vi.fn(async () => JSON.stringify({ kind: 'draft', text: '카페 코스예요', regions: ['강릉'], places: [
      { day: 1, ref: 'c1', name: '테라로사', kind: 'break', why: ' 바다 가는 길에 들르기 좋은 대형 로스터리 ' },
      { day: 1, ref: 'c9', name: '없는곳', kind: 'break', why: '' },
      { day: 1, name: '지어낸카페', kind: 'break', why: '' },
    ] }));
    const handler = createAiChatHandler({ getUser: async () => ({ id: 'u' }), callModel, ...quota() });
    const result = await handler(post({ ...body, candidates }));
    expect(result.status).toBe(200);
    const reply = JSON.parse((await result.json()).content);
    expect(reply.places).toEqual([{ day: 1, ref: 'c1', name: '테라로사 커피공장', kind: 'break', why: '바다 가는 길에 들르기 좋은 대형 로스터리' }]);
    const prompt = callModel.mock.calls[0]![0];
    expect(prompt.system).toContain('장소는 [후보]에서만 ref로 고른다');
    expect(prompt.user).toContain('테라로사 커피공장');
  });
  it('후보에서 하나도 못 고른 초안은 추천 답으로 낮춘다', async () => {
    const callModel = vi.fn(async () => JSON.stringify({ kind: 'draft', text: '여기 어때요', regions: [], places: [{ day: 1, name: '지어낸곳', kind: 'place' }] }));
    const handler = createAiChatHandler({ getUser: async () => ({ id: 'u' }), callModel, ...quota() });
    const reply = JSON.parse((await (await handler(post({ ...body, candidates }))).json()).content);
    expect(reply.kind).toBe('explore');
    expect(reply.places).toEqual([]);
  });
  it('후보가 없으면 예전처럼 이름을 받는다', async () => {
    const callModel = vi.fn(async () => JSON.stringify({ kind: 'draft', text: '코스', regions: ['강릉'], places: [{ day: 1, name: '안목해변', kind: 'place' }] }));
    const handler = createAiChatHandler({ getUser: async () => ({ id: 'u' }), callModel, ...quota() });
    const reply = JSON.parse((await (await handler(post(body))).json()).content);
    expect(reply.places).toEqual([{ day: 1, name: '안목해변', kind: 'place' }]);
    expect(callModel.mock.calls[0]![0].system).not.toContain('장소는 [후보]에서만 ref로 고른다');
  });
  it('후보 모양이 틀리거나 40곳을 넘으면 거절한다', async () => {
    const handler = createAiChatHandler({ getUser: async () => ({ id: 'u' }), callModel: vi.fn(async () => '{}'), ...quota() });
    expect((await handler(post({ ...body, candidates: [{ ...candidates[0], id: 'zz' }] }))).status).toBe(400);
    expect((await handler(post({ ...body, candidates: Array.from({ length: 41 }, (_, i) => ({ ...candidates[0], id: `c${i + 1}` })) }))).status).toBe(400);
  });
});
