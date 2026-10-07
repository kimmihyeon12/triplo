import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PageBar } from '../../../../core/page-bar';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { AdminUsage } from '../../data/admin-usage';
import { isAdminDenied } from '../../data/admin-support';
import { adminExit } from '../admin-exit';
import {
  FREE_LIMITS,
  PRICE_CHECKED_ON,
  monthCost,
  rowCostKrw,
  usageLevel,
  type AiCallKind,
  type UsageLevel,
  type UsageSummary,
} from '../../model/usage';

export interface Meter {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly percent: number;
  readonly level: UsageLevel;
  readonly status: string;
}

const KIND_LABEL: Record<AiCallKind, string> = { plan: '일정 짜기', chat: '챗봇', receipt: '사진 읽기' };
const LEVEL_LABEL: Record<UsageLevel, string> = { ok: '여유', warn: '80% 넘음', over: '한도 도달' };
const mb = (bytes: number) => `${(bytes / 1024 ** 2).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}MB`;
const won = (krw: number) => `${Math.round(krw).toLocaleString('ko-KR')}원`;
const n = (value: number) => value.toLocaleString('ko-KR');

function meter(id: string, label: string, used: number, limit: number, value: string): Meter {
  const level = usageLevel(used, limit);
  return { id, label, value, percent: Math.round((used / limit) * 100), level, status: LEVEL_LABEL[level] };
}

/** 무료 한도에 얼마나 가까운지, 유료였다면 이번 달 얼마였을지 본다(2026-10-07). */
@Component({
  selector: 'app-admin-usage',
  imports: [UiNotice, UiSpinner, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-usage.html',
})
export class AdminUsagePage {
  private readonly usage = inject(AdminUsage);
  private readonly exit = adminExit();
  readonly priceCheckedOn = PRICE_CHECKED_ON;
  readonly summary = signal<UsageSummary | null>(null);
  readonly error = signal<string | null>(null);

  readonly geminiMeter = computed(() => {
    const s = this.summary();
    if (!s) return null;
    const used = s.gemini.dayRequests;
    const limit = FREE_LIMITS.geminiDailyRequests;
    return meter('gemini-day', '오늘 Gemini 호출', used, limit, `${n(used)} / ${n(limit)}회`);
  });

  readonly supabaseMeters = computed(() => {
    const s = this.summary()?.supabase;
    if (!s) return [];
    return [
      meter('db', 'DB 크기', s.dbBytes, FREE_LIMITS.dbBytes, `${mb(s.dbBytes)} / ${mb(FREE_LIMITS.dbBytes)}`),
      meter('storage', '파일 저장소', s.storageBytes, FREE_LIMITS.storageBytes, `${mb(s.storageBytes)} / 1GB`),
      meter(
        'users',
        '최근 30일 로그인 사용자',
        s.activeUsers30d,
        FREE_LIMITS.activeUsers,
        `${n(s.activeUsers30d)} / ${n(FREE_LIMITS.activeUsers)}명`,
      ),
    ];
  });

  /** Gemini 하루 한도는 태평양 시간 0시에 다시 채워진다. 한국 시간으로 보인다. */
  readonly resetAt = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const next = new Date(new Date(s.gemini.dayStart).getTime() + 24 * 60 * 60 * 1000);
    return next.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  });

  readonly monthRows = computed(() =>
    (this.summary()?.gemini.month ?? []).map((row) => {
      const cost = rowCostKrw(row);
      return {
        key: `${row.kind}-${row.model}`,
        label: KIND_LABEL[row.kind],
        model: row.model,
        requests: n(row.requests),
        tokens: `입력 ${n(row.inputTokens)} · 출력 ${n(row.outputTokens)}`,
        cost: cost === null ? '단가 미등록' : won(cost),
      };
    }),
  );

  readonly monthTotal = computed(() => {
    const s = this.summary();
    if (!s) return null;
    const cost = monthCost(s.gemini.month);
    return { krw: won(cost.totalKrw), unpriced: cost.unpricedRequests };
  });

  constructor() {
    inject(PageBar).set({ title: '사용량', back: ['/admin'], action: null });
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.summary.set(await this.usage.summary());
      this.error.set(null);
    } catch (error) {
      if (isAdminDenied(error)) {
        void this.exit.denied();
        return;
      }
      this.error.set('사용량을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');
    }
  }
}
