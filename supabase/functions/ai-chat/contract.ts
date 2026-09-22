/** Shared wire validation; deliberately independent of framework and model SDK. */
export interface ChatWireReply {
  kind: 'explore' | 'draft' | 'reference' | 'outside' | 'refusal';
  text: string;
  regions: string[];
  places: {day: number; name: string; kind: 'place' | 'meal' | 'break' | 'buffer'}[];
  chips: string[];
  reference: {subject: string; body: string; links: {label: string; url: string}[]} | null;
  edit: null;
}

export function normalizeChatResponse(content: string): ChatWireReply {
  if (typeof content !== 'string' || content.length > 60000) throw new Error('invalid_response');
  const raw = JSON.parse(content);
  if (!raw || typeof raw !== 'object' || !['explore','draft','reference','outside','refusal'].includes(raw.kind)
    || typeof raw.text !== 'string' || !raw.text.trim() || raw.text.length > 6000) throw new Error('invalid_response');
  const regions = Array.isArray(raw.regions) ? raw.regions.filter((r: unknown): r is string => typeof r === 'string' && !!r.trim() && r.length <= 80).slice(0, 10) : [];
  const places: ChatWireReply['places'] = [];
  if (raw.kind === 'draft' && Array.isArray(raw.places)) {
    for (const place of raw.places.slice(0, 30)) {
      if (!place || !Number.isInteger(place.day) || place.day < 1 || place.day > 30 || typeof place.name !== 'string' || !place.name.trim() || place.name.length > 120 || !['place','meal','break','buffer'].includes(place.kind)) throw new Error('invalid_response');
      places.push({day: place.day, name: place.name.trim(), kind: place.kind});
    }
  }
  if (raw.kind === 'draft' && !places.length) throw new Error('invalid_response');
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
  return {kind: raw.kind, text: raw.text.trim(), regions, places, reference, chips: [], edit: null};
}
