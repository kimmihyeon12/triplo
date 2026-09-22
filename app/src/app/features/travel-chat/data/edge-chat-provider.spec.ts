import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../auth/data/auth-store';
import { EdgeChatProvider } from './edge-chat-provider';
import { normalizeChatResponse } from '../../../../../../supabase/functions/ai-chat/contract';

const request = {input:'먹방 코스 추천해줘',scope:'trip' as const,history:[],trip:null};
describe('real chat provider', () => {
  it('does not start an aborted request and forwards cancellation', async () => {
    const callFunction = vi.fn(async () => ({content: JSON.stringify({kind:'explore',text:'응답'})}));
    const injector = Injector.create({providers:[{provide:AuthStore,useValue:{available:()=>true,callFunction}},EdgeChatProvider]});
    const provider = runInInjectionContext(injector,()=>injector.get(EdgeChatProvider));
    const controller = new AbortController();
    controller.abort();
    await expect(provider.reply(request,controller.signal)).rejects.toThrow();
    expect(callFunction).not.toHaveBeenCalled();
    const active = new AbortController();
    await provider.reply(request,active.signal);
    expect(callFunction.mock.calls[0][2]).toBe(active.signal);
  });
  it('calls ai-chat with the conversation, not a fixture', async () => {
    const callFunction = vi.fn(async () => ({content: JSON.stringify({kind:'explore',text:'지역을 알려 주세요.',regions:[],places:[]})}));
    const injector = Injector.create({providers:[{provide:AuthStore,useValue:{available:()=>true,callFunction}},EdgeChatProvider]});
    const provider = runInInjectionContext(injector,()=>injector.get(EdgeChatProvider));
    expect((await provider.reply(request,new AbortController().signal)).text).toContain('지역');
    expect(callFunction.mock.calls[0][0]).toBe('ai-chat');
  });
  it('strips invented coordinates, links and model edit instructions', () => {
    const result = normalizeChatResponse(JSON.stringify({kind:'draft',text:'추천 코스',regions:['강릉'],places:[{day:1,name:'오죽헌',kind:'place',lat:123,address:'invented'}],edit:{action:'remove',names:['전부']}}));
    expect(result.edit).toBeNull();
    expect(result.places).toEqual([{day:1,name:'오죽헌',kind:'place'}]);
  });
  it('requires valid JSON and useful content', () => {
    expect(()=>normalizeChatResponse('{}')).toThrow();
    expect(()=>normalizeChatResponse('not json')).toThrow();
  });
  it('supplies controlled reference links for unverified business information', () => {
    const result = normalizeChatResponse(JSON.stringify({kind:'reference',text:'방문 전에 확인해 주세요.',reference:{subject:'오죽헌',body:'시간은 변경될 수 있어요.',links:[{url:'javascript:alert(1)'}]}}));
    expect(result.reference!.links[0].url).toContain('https://map.naver.com/');
  });
});
