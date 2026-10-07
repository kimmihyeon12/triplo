import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import { enumerateDays } from '../../../shared/util/dates';
import { findRegionByName } from '../../../shared/util/korea-regions';
import { PLACE_SEARCH } from '../../places/data/place-search';
import { verifyPlaces } from '../../ai-planning/data/verify-places';
import {
  EMPTY_POOL,
  chatQueries,
  gatherCandidates,
  type CandidatePool,
  type CandidateQuery,
} from '../../ai-planning/data/place-candidates';
import { chatRegions } from '../util/chat-regions';
import { chatPeriod } from '../util/chat-period';
import { todayIso } from '../../../shared/util/dates';
import type { GeoPoint } from '../../places/model/place';
import { newId } from '../../trips/util/factories';
import type { Trip } from '../../trips/model/trip';
import { LEDGER_REPOSITORY } from '../../expenses/data/ledger-repository';
import { ledgerOps, sameLedger } from '../../expenses/util/ledger-ops';
import type { Ledger } from '../../expenses/model/ledger';
import { localCommand } from '../util/local-commands';
import { isLedgerCommand, ledgerCommand } from '../util/local-ledger-commands';
import { tripVersion, type LocalResult } from '../util/local-command-draft';
import {
  CHAT_TURN_LIMIT,
  type ChatDraft,
  type ChatError,
  type ChatMessage,
  type ChatPlace,
  type ChatReply,
  type ChatScope,
} from '../model/chat';
import { applyDraft, nearestOrder } from '../util/chat-draft';
import { isBlankInput } from '../util/chat-scope';
import { listChips, tripChips, refreshChips } from '../util/chat-suggestions';
import { answerLocally } from '../util/local-answer';
import { CHAT_HISTORY } from './chat-history';
import { CHAT_PROVIDER, type ChatTripContext, type ChatTurn } from './chat-provider';

/**
 * 대화 상태. 기존 `AiPlanStore`와 같은 signalState 패턴을 쓴다.
 *
 * 보관하는 값은 대화 기록, 진행 중 요청의 중단 손잡이, 초안, 마지막 적용
 * 결과다. 화면은 이 store만 보고 그린다.
 */

/** 모델에게 넘길 앞선 대화의 줄 수. 너무 길면 요청이 커지고 답이 흐려진다. */
const HISTORY_WINDOW = 10;

/** 랜덤 뽑기에서 잠시 제외할 지역의 수. 이만큼은 연달아 나오지 않는다. */
const RECENT_REGION_MEMORY = 5;

@Injectable()
export class TravelChatStore {
  private readonly provider = inject(CHAT_PROVIDER);
  private readonly placeSearch = inject(PLACE_SEARCH);
  private readonly history = inject(CHAT_HISTORY);
  private readonly ledger = inject(LEDGER_REPOSITORY);
  private undoLedger: { before: Ledger; after: Ledger } | null = null;
  private appliedVersion: string | null = null;

  private readonly state = signalState({
    scope: 'list' as ChatScope,
    /** 대화 대상 여행. 여행 목록에서 열면 없다. */
    trip: null as Trip | null,
    messages: [] as readonly ChatMessage[],
    /** 모델을 실제로 부른 횟수. 가로챈 답은 세지 않는다. */
    turnsUsed: 0,
    pending: false,
    error: null as ChatError | null,
    /** 최근에 뽑은 지역 코드. 같은 곳이 연달아 나오지 않게 한다. */
    recentRegions: [] as readonly string[],
    /** 적용 직전의 여행. 되돌리기에 쓴다. */
    undoTrip: null as Trip | null,
  });

  /** 진행 중인 요청을 취소하는 손잡이. */
  private running: AbortController | null = null;

  readonly scope = this.state.scope;
  readonly trip = this.state.trip;
  readonly messages = this.state.messages;
  readonly turnsUsed = this.state.turnsUsed;
  readonly pending = this.state.pending;
  readonly error = this.state.error;

  /** 남은 호출 횟수. 화면에 몇 번 더 물을 수 있는지 알린다. */
  readonly turnsLeft = computed(() => Math.max(0, CHAT_TURN_LIMIT - this.turnsUsed()));
  readonly atLimit = computed(() => this.turnsUsed() >= CHAT_TURN_LIMIT);

  /**
   * 지금 보여줄 추천 칩. 마지막 답이 칩을 들고 있으면 그것을 쓰고, 없으면
   * 어디서 열었는지에 따라 기본 칩을 쓴다.
   */
  readonly chips = computed<readonly string[]>(() => {
    const last = this.messages().at(-1);
    if (last?.chips.length) return refreshChips(last.chips);
    const trip = this.trip();
    return trip ? tripChips(trip) : listChips();
  });

  readonly canUndo = computed(() => this.state.undoTrip() !== null);
  readonly isEmpty = computed(() => this.messages().length === 0);

  /** 대화를 연다. 앞서 나눈 기록이 있으면 이어서 보여준다. */
  open(scope: ChatScope, trip: Trip | null): void {
    patchState(this.state, { scope, trip, error: null });
    void this.history.load(trip?.id ?? null).then((messages) => {
      // 여는 사이에 사용자가 이미 말을 걸었으면 덮어쓰지 않는다.
      if (this.messages().length === 0 && messages.length > 0) patchState(this.state, { messages });
    });
  }

  /** 대화 대상 여행이 바뀌었을 때 따라간다. 화면이 일정을 고치면 불린다. */
  setTrip(trip: Trip | null): void {
    patchState(this.state, { trip });
  }

  /**
   * 사용자의 말을 보낸다.
   *
   * 모델을 부르기 전에 앱이 답할 수 있는지 먼저 본다. 답할 수 있으면 그대로
   * 쓰고 호출 횟수를 쓰지 않는다. 무료 한도를 아끼고, 저장된 값으로 계산하는
   * 편이 모델의 짐작보다 정확하기 때문이다.
   */
  async send(input: string): Promise<void> {
    if (isBlankInput(input) || this.pending()) return;
    const text = input.trim();
    this.push({ role: 'user', kind: null, text });
    patchState(this.state, { error: null });

    try {
      const trip = this.trip();
      let command: LocalResult | null = null;
      if (/^(?:방금 |마지막 )?(?:변경 |작업 )?(?:되돌려|취소해)(?:줘)?[.!?]*$/.test(text)) {
        const previous = this.state.undoTrip();
        if (trip && previous && this.appliedVersion === tripVersion(trip)) {
          command = {text: '마지막 변경을 되돌릴게요. 확인 후 적용해 주세요.', draft: {
            action: 'local-change', title: '마지막 변경 되돌리기', before: trip, after: previous,
            ...(this.undoLedger ? {ledger: {before: this.undoLedger.after, after: this.undoLedger.before}} : {}),
          }};
        } else command = {text: '되돌릴 변경이 없거나 이후 일정이 달라졌어요.'};
      } else if (isLedgerCommand(text)) {
        command = trip ? ledgerCommand(text, trip, await this.ledger.read(trip.id)) : {text: '먼저 경비를 확인할 여행을 열어 주세요.'};
      } else command = localCommand(text, trip);
      if (command) {
        this.push({role: 'assistant', kind: command.draft ? 'draft' : 'explore', ...command});
        return;
      }
    } catch (error) {
      patchState(this.state, {error: toChatError(error)});
      return;
    }

    // 앱이 직접 답할 수 있는 질문은 여기서 끝난다.
    const local = answerLocally(text, this.trip(), this.state.recentRegions());
    if (local) {
      this.rememberRegion(local.regions);
      await this.receive(local);
      return;
    }

    if (this.atLimit()) {
      patchState(this.state, {
        error: {
          kind: 'limit',
          message: `한 대화에서 ${CHAT_TURN_LIMIT}번까지 물어볼 수 있어요. 지금까지 찾은 곳을 담고 새 대화를 시작해 주세요.`,
        },
      });
      return;
    }

    const controller = new AbortController();
    this.running = controller;
    patchState(this.state, { pending: true });
    try {
      // 실제 장소 후보를 먼저 모은다. 모델은 이 안에서 번호로만 고른다(2026-10-01).
      // 찾을 지역이 없으면 기다리지 않고 바로 보낸다.
      const search = this.candidateSearch(text);
      const pool = search.queries.length
        ? await gatherCandidates(this.placeSearch, search.queries, { exclude: search.exclude, max: 40 }).catch(() => EMPTY_POOL)
        : EMPTY_POOL;
      if (controller.signal.aborted) return;
      const reply = await this.provider.reply(
        {
          ...(pool.wire.length ? { candidates: pool.wire } : {}),
          input: text,
          scope: this.scope(),
          history: this.recentTurns(),
          trip: this.tripContext(),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      patchState(this.state, { turnsUsed: this.turnsUsed() + 1 });
      await this.receive(reply, pool);
    } catch (error) {
      if (controller.signal.aborted) return;
      // 실패해도 주고받은 말은 지우지 않는다. 다시 물을 때 문맥이 남아야 한다.
      patchState(this.state, { error: toChatError(error) });
    } finally {
      if (this.running === controller) {
        this.running = null;
        patchState(this.state, { pending: false });
      }
    }
  }

  /** 기다리는 중에 그만둔다. 이미 주고받은 말은 남는다. */
  cancel(): void {
    this.running?.abort();
    this.running = null;
    patchState(this.state, { pending: false });
  }

  /** 대화를 처음부터 다시 시작한다. 호출 횟수도 초기화된다. */
  async reset(): Promise<void> {
    this.cancel();
    this.undoLedger = null;
    this.appliedVersion = null;
    patchState(this.state, {
      messages: [],
      turnsUsed: 0,
      error: null,
      undoTrip: null,
      recentRegions: [],
    });
    const targets = this.scope() === 'list' ? [this.trip()?.id ?? null, null] : [this.trip()?.id ?? null];
    if (this.scope() === 'list') this.setTrip(null);
    // 서버 기록을 지우지 못해도 새 대화는 연다. 다른 기기에서 다시 보일 수 있다는 것만 알린다.
    const results = await Promise.allSettled(targets.map((id) => this.history.clear(id)));
    if (results.some((r) => r.status === 'rejected')) {
      patchState(this.state, {
        error: { kind: 'other', message: '이전 대화를 서버에서 지우지 못했어요. 다른 기기에서 다시 보일 수 있어요.' },
      });
    }
  }

  /**
   * 확인한 변경을 여행에 반영하고 그 결과를 돌려준다. 저장은 화면이 한다.
   * 적용 직전의 여행을 보관해 되돌리기를 제공한다.
   */
  async applyDraft(draft: ChatDraft): Promise<Trip | null> {
    const current = this.trip();
    if (!current) return null;
    const next = applyDraft(current, draft);
    if (next === current) {
      patchState(this.state, {error: {kind: 'other', message: '일정이 변경되어 이전 제안을 적용할 수 없어요. 다시 요청해 주세요.'}});
      return null;
    }
    const ledgerChange = draft.action === 'local-change' ? draft.ledger : undefined;
    if (ledgerChange) {
      try {
        // 가계부는 동작 한 건씩 저장한다. 미리보기 뒤 다른 곳에서 바뀌었으면 적용하지 않는다.
        if (!sameLedger(await this.ledger.read(current.id), ledgerChange.before)) throw new Error('가계부가 변경되었어요. 다시 요청해 주세요.');
        await this.ledger.apply(current.id, ledgerOps(ledgerChange.before, ledgerChange.after));
      } catch (error) {
        patchState(this.state, {error: toChatError(error)});
        return null;
      }
    }
    this.undoLedger = ledgerChange ?? null;
    this.appliedVersion = tripVersion(next);
    patchState(this.state, { trip: next, undoTrip: current });
    return next;
  }

  /** 마지막 적용을 되돌린다. 저장은 화면이 한다. */
  async undo(): Promise<Trip | null> {
    const previous = this.state.undoTrip();
    if (!previous) return null;
    const current = this.trip();
    if (!current || this.appliedVersion !== tripVersion(current)) {
      patchState(this.state, {error: {kind: 'other', message: '이후 일정이 변경되어 되돌릴 수 없어요.'}});
      return null;
    }
    if (this.undoLedger) {
      try {
        if (!sameLedger(await this.ledger.read(current.id), this.undoLedger.after)) throw new Error('이후 가계부가 변경되어 되돌릴 수 없어요.');
        await this.ledger.apply(current.id, ledgerOps(this.undoLedger.after, this.undoLedger.before));
      } catch (error) {
        patchState(this.state, {error: toChatError(error)});
        return null;
      }
    }
    this.undoLedger = null;
    this.appliedVersion = null;
    patchState(this.state, { trip: previous, undoTrip: null });
    return previous;
  }

  /** 되돌릴 수 있는 상태를 지운다. 사용자가 다른 일을 하면 불린다. */
  clearUndo(): void {
    this.undoLedger = null;
    this.appliedVersion = null;
    patchState(this.state, { undoTrip: null });
  }

  /**
   * 받은 답을 대화에 넣는다. 초안이 딸려 있으면 장소 검색으로 대조한 뒤에만
   * 확인 카드를 만든다. 모델이 낸 이름을 그대로 담으면 좌표 없는 항목이
   * 일정에 들어간다.
   */
  private async receive(reply: ChatReply, pool: CandidatePool = EMPTY_POOL): Promise<void> {
    const draft = await this.toDraft(reply, pool);
    if (reply.kind === 'draft' && !draft) {
      // 초안을 내겠다고 했는데 담을 수 있는 장소가 없는 경우다.
      patchState(this.state, {
        error: {
          kind: 'empty',
          message: '실제로 있는 장소를 찾지 못했어요. 조건을 조금 바꿔서 다시 물어봐 주세요.',
        },
      });
      this.push({ role: 'assistant', kind: reply.kind, text: reply.text, chips: reply.chips });
      return;
    }
    this.push({
      role: 'assistant',
      kind: reply.kind,
      text: reply.text,
      reference: reply.reference,
      chips: reply.chips,
      draft,
    });
  }

  /**
   * 답에 딸린 제안을 확인 카드가 쓸 초안으로 바꾼다.
   *
   * 새 장소는 카카오 장소 검색으로 대조해 좌표·주소·분류를 채운다. 일정 편집은
   * 저장된 값만 쓰므로 대조할 것이 없다.
   */
  private async toDraft(reply: ChatReply, pool: CandidatePool = EMPTY_POOL): Promise<ChatDraft | null> {
    if (reply.edit) return this.editToDraft(reply.edit);
    if (reply.places.length === 0) return null;

    const regions = reply.regions.length
      ? reply.regions
      : (this.trip()?.regions ?? []).map((r) => r.name);
    // 후보 번호로 고른 답이면 후보(검색 결과)의 좌표·주소를 그대로 붙인다. 다시 찾지 않는다.
    if (pool.wire.length) {
      const places = reply.places.flatMap((p, i): ChatPlace[] => {
        const hit = p.ref ? pool.byId.get(p.ref) : undefined;
        if (!hit) return [];
        const kind =
          hit.kind === 'stay' ? 'place'
          : hit.kind === 'place' && (p.kind === 'activity' || p.kind === 'shopping') ? p.kind
          : hit.kind;
        return [{
          id: `ai-${i}`, day: p.day, order: i + 1, start: null, moveToNext: null,
          name: hit.name, kind, verified: true, note: hit.category,
          address: hit.roadAddress || hit.address,
          location: { lat: hit.lat, lng: hit.lng },
          placeRef: { provider: hit.provider, id: hit.id, url: hit.url },
          ...(p.why ? { why: p.why } : {}),
        }];
      });
      return places.length ? { action: 'append', regions, places, ...this.periodOf() } : null;
    }
    // 챗봇은 숙소를 숙박으로 담지 않는다. 검색 분류가 숙박이면 예전처럼 관광으로 담는다.
    const verified = (await verifyPlaces(reply.places, regions, this.placeSearch)).map(
      (p): ChatPlace => ({ ...p, kind: p.kind === 'stay' ? 'place' : p.kind }),
    );
    // 확인된 것이 하나도 없으면 담을 수 없다. 확인 카드를 띄우지 않는다.
    if (!verified.some((p) => p.verified)) return null;
    return { action: 'append', regions, places: verified, ...this.periodOf() };
  }

  /** 모델이 해석한 편집 의도를 실제 대상이 있는 초안으로 바꾼다. */
  private editToDraft(edit: NonNullable<ChatReply['edit']>): ChatDraft | null {
    const trip = this.trip();
    if (!trip) return null;
    switch (edit.action) {
      case 'assign-unassigned': {
        const stopIds = trip.stops.filter(s => !s.excluded && s.date === null)
          .sort((a, b) => a.order - b.order).map(s => s.id);
        return stopIds.length ? { action: 'assign-unassigned', date: edit.date, stopIds } : null;
      }
      case 'distribute': {
        // 앱이 만든 배치를 그대로 쓰되, 지금도 날짜 없는 장소만 남긴다.
        const open = new Set(trip.stops.filter((s) => !s.excluded && s.date === null).map((s) => s.id));
        const assignments = edit.assignments.filter((a) => open.has(a.stopId));
        return assignments.length ? { action: 'distribute', assignments } : null;
      }
      case 'remove': {
        const names = new Set(edit.names);
        const ids = trip.stops.filter((s) => names.has(s.name)).map((s) => s.id);
        return ids.length ? { action: 'remove', stopIds: ids } : null;
      }
      case 'move': {
        const stops = trip.stops
          .filter((s) => s.date === edit.date && !s.excluded)
          .sort((a, b) => a.order - b.order);
        if (stops.length < 2) return null;
        return { action: 'move', date: edit.date, orderedStopIds: nearestOrder(stops) };
      }
      case 'reschedule': {
        const target = trip.stops.find((s) => s.name === edit.name);
        if (!target || !trip.startDate) return null;
        const days = enumerateDays(trip.startDate, trip.endDate ?? trip.startDate);
        const date = days[edit.day - 1] ?? null;
        return date ? { action: 'reschedule', stopId: target.id, date } : null;
      }
    }
  }

  /** 실제 저장 성공 후 앱이 알린다. AI 호출과 사용량 차감은 없다. */
  notifyTripSaved(tripId: string): void {
    this.push({role: 'system', kind: 'explore', text: '여행에 담았어요. 일정을 확인해 보세요.',
      localLink: `/trips/${encodeURIComponent(tripId)}`, localLinkLabel: '여행 보기'});
  }

  private push(partial: Pick<ChatMessage, 'role' | 'kind' | 'text'> & Partial<ChatMessage>): void {
    const message: ChatMessage = {
      id: newId(),
      reference: null,
      draft: null,
      chips: [],
      at: nextAt(this.messages().at(-1)?.at),
      ...partial,
    };
    const messages = [...this.messages(), message];
    patchState(this.state, { messages });
    void this.history.append(this.trip()?.id ?? null, message).catch(() => undefined);
  }

  /** 모델에게 넘길 앞선 대화. 시스템 안내는 빼고 주고받은 말만 준다. */
  private recentTurns(): readonly ChatTurn[] {
    return this.messages()
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
      .slice(-HISTORY_WINDOW)
      .map((m) => ({ role: m.role, text: m.text }));
  }

  /**
   * 이번 질문으로 장소 후보를 모은다. 여행 상세면 그 여행의 지역, 전체 채팅이면 질문(없으면
   * 최근 대화)에서 읽은 지역으로 찾는다. 질문이 'N일차'를 가리키면 그날 장소 근처에서 찾는다.
   * 지역을 모르면 후보 없이 보낸다. 모델이 지역을 묻는다.
   */
  private candidateSearch(text: string): { queries: CandidateQuery[]; exclude: string[] } {
    const trip = this.trip();
    const regions = trip
      ? trip.regions.map((r) => r.name)
      : chatRegions(text).length
        ? chatRegions(text)
        : chatRegions(this.recentTurns().filter((t) => t.role === 'user').map((t) => t.text).join(' '));
    let near: GeoPoint | null = null;
    const dayMatch = /(\d+)\s*일차/.exec(text);
    if (trip && dayMatch && trip.startDate && trip.endDate) {
      const date = enumerateDays(trip.startDate, trip.endDate)[Number(dayMatch[1]) - 1];
      near = trip.stops.find((s) => s.date === date && !s.excluded && s.location)?.location ?? null;
    }
    const exclude = trip ? trip.stops.map((s) => s.name) : [];
    return { queries: chatQueries(regions, text, near), exclude };
  }

  /**
   * 새 여행을 만들 대화라면 사용자가 말한 기간을 읽는다. 최근 말부터 본다.
   * 여행 상세에서 연 대화는 이미 날짜가 있는 여행이라 읽지 않는다.
   */
  private periodOf(): { period?: { start: string; end: string } } {
    if (this.trip()) return {};
    const today = todayIso();
    for (const turn of [...this.recentTurns()].reverse()) {
      if (turn.role !== 'user') continue;
      const period = chatPeriod(turn.text, today);
      if (period) return { period };
    }
    return {};
  }

  /** 모델에게 넘길 여행 요약. 좌표는 넘기지 않는다. */
  private tripContext(): ChatTripContext | null {
    const trip = this.trip();
    if (!trip) return null;
    const days = trip.startDate && trip.endDate ? enumerateDays(trip.startDate, trip.endDate) : [];
    return {
      title: trip.title,
      regions: trip.regions.map((r) => r.name),
      dayCount: days.length || 1,
      days: days.map((date, i) => ({
        day: i + 1,
        names: trip.stops
          .filter((s) => s.date === date && !s.excluded)
          .sort((a, b) => a.order - b.order)
          .map((s) => s.name),
      })),
      unassigned: trip.stops.filter((s) => s.date === null && !s.excluded).map((s) => s.name),
    };
  }

  /** 뽑은 지역을 기억해 연달아 같은 곳이 나오지 않게 한다. */
  private rememberRegion(regions: readonly string[]): void {
    const codes = regions
      .map((name) => findRegionByName(name)?.code)
      .filter((c): c is string => !!c);
    if (!codes.length) return;
    patchState(this.state, {
      recentRegions: [...this.state.recentRegions(), ...codes].slice(-RECENT_REGION_MEMORY),
    });
  }
}

function toChatError(error: unknown): ChatError {
  const message = error instanceof Error ? error.message : '알 수 없는 오류가 생겼습니다.';
  if (/오늘 사용량|모두 썼어요|무료 사용량/.test(message)) return { kind: 'quota', message };
  if (message.includes('오래 걸립니다')) return { kind: 'timeout', message };
  // fetch가 네트워크에 닿지 못하면 'Failed to fetch'를 던진다.
  if (error instanceof TypeError)
    return { kind: 'offline', message: 'AI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.' };
  return { kind: 'other', message };
}

/**
 * 새 줄의 시각. 앞 줄과 같은 밀리초면 1ms 뒤로 민다. 서버는 시각 순서로 대화를 돌려주므로
 * 질문과 바로 이어진 앱의 답이 같은 시각이면 다시 열었을 때 순서가 뒤바뀔 수 있다.
 */
function nextAt(previous: string | undefined): string {
  const now = Date.now();
  const last = previous ? Date.parse(previous) : Number.NaN;
  return new Date(Number.isNaN(last) || now > last ? now : last + 1).toISOString();
}
