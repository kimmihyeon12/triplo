/** Shared wire validation; deliberately independent of framework and model SDK. */
export interface ChatWireReply {
  kind: 'explore' | 'draft' | 'reference' | 'outside' | 'refusal';
  text: string;
  regions: string[];
  places: {day: number; name: string; kind: 'place' | 'activity' | 'meal' | 'break' | 'shopping' | 'other' | 'buffer'; ref?: string; why?: string}[];
  chips: string[];
  reference: {subject: string; body: string; links: {label: string; url: string}[]} | null;
  edit: null;
}

/** 앱이 카카오 검색으로 모아 보낸 장소 후보. 모델은 이 id(ref)로만 장소를 고른다(2026-10-01). */
export interface ChatCandidate {id: string; name: string; kind: string; category: string; area: string}

export function normalizeChatResponse(content: string, candidates: readonly ChatCandidate[] = []): ChatWireReply {
  if (typeof content !== 'string' || content.length > 60000) throw new Error('invalid_response');
  const raw = JSON.parse(content);
  if (!raw || typeof raw !== 'object' || !['explore','draft','reference','outside','refusal'].includes(raw.kind)
    || typeof raw.text !== 'string' || !raw.text.trim() || raw.text.length > 6000) throw new Error('invalid_response');
  const regions = Array.isArray(raw.regions) ? raw.regions.filter((r: unknown): r is string => typeof r === 'string' && !!r.trim() && r.length <= 80).slice(0, 10) : [];
  const places: ChatWireReply['places'] = [];
  const grounded = candidates.length > 0;
  if (raw.kind === 'draft' && Array.isArray(raw.places) && grounded) {
    // 후보를 보낸 요청: 후보에 있는 번호만 받고 이름은 후보 이름으로 바꾼다. 지어낸 장소는 버린다.
    for (const place of raw.places.slice(0, 30)) {
      const hit = place && typeof place.ref === 'string' ? candidates.find((c) => c.id === place.ref) : undefined;
      if (!hit || !Number.isInteger(place.day) || place.day < 1 || place.day > 30) continue;
      const kind = ['place','activity','meal','break','shopping','other','buffer'].includes(place.kind) ? place.kind : 'place';
      const why = typeof place.why === 'string' ? place.why.trim().slice(0, 80) : '';
      places.push({day: place.day, ref: hit.id, name: hit.name, kind, ...(why ? {why} : {})});
    }
  } else if (raw.kind === 'draft' && Array.isArray(raw.places)) {
    for (const place of raw.places.slice(0, 30)) {
      if (!place || !Number.isInteger(place.day) || place.day < 1 || place.day > 30 || typeof place.name !== 'string' || !place.name.trim() || place.name.length > 120 || !['place','activity','meal','break','shopping','other','buffer'].includes(place.kind)) throw new Error('invalid_response');
      const why = typeof place.why === 'string' ? place.why.trim().slice(0, 80) : '';
      places.push({day: place.day, name: place.name.trim(), kind: place.kind, ...(why ? {why} : {})});
    }
  }
  // 후보에서 하나도 못 고른 초안은 답글만 남긴다. 후보 없는 요청에서 빈 초안은 쓸 수 없는 답이다.
  let kind = raw.kind;
  if (kind === 'draft' && !places.length) {
    if (!grounded) throw new Error('invalid_response');
    kind = 'explore';
  }
  let reference: ChatWireReply['reference'] = null;
  if (raw.kind === 'reference') {
    const ref = raw.reference;
    if (!ref || typeof ref.subject !== 'string' || !ref.subject.trim() || ref.subject.length > 120 || typeof ref.body !== 'string' || !ref.body.trim() || ref.body.length > 4000) throw new Error('invalid_response');
    const query = encodeURIComponent(ref.subject);
    reference = {subject: ref.subject, body: ref.body, links: [
      {label:'네이버 지도',url:`https://map.naver.com/p/search/${query}`},
      {label:'카카오맵',url:`https://map.kakao.com/?q=${query}`},
    ]};
  }
  // Never accept local mutation intents, coordinates, addresses or arbitrary URLs from a model.
  return {kind, text: raw.text.trim(), regions, places, reference, chips: [], edit: null};
}
