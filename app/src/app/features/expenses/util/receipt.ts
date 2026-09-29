import { EXPENSE_CATEGORIES, type Expense, type ExpensePerson } from '../model/ledger';
import { allocateEvenly } from './ledger';

/**
 * 사진에서 읽은 지출 후보. 모델이 낸 값이므로 사용자가 확인 화면에서 고치고
 * 체크하기 전에는 저장하지 않는다.
 */
export interface ReceiptDraft {
  title: string;
  amount: number;
  /** 사진에 날짜가 없으면 빈 값. 저장할 때 여행 날짜로 채운다. */
  date: string;
  category: string;
  checked: boolean;
}

export interface ReceiptScanResult {
  /** 영수증 상단의 가게 이름. 합치기의 기본 제목으로 쓴다. */
  store: string;
  /** 사진에 적힌 합계. 없으면 0. 체크한 합과 비교해 안내만 한다. */
  total: number;
  drafts: ReceiptDraft[];
  /** 검증을 통과하지 못해 뺀 항목 수. */
  dropped: number;
}

const MAX_ITEMS = 30;
const MAX_TITLE = 40;
const MAX_AMOUNT = 100_000_000;

export const RECEIPT_MEMO = '사진에서 읽음';

const validAmount = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT;

/** 형식만 맞고 없는 날(2월 30일 등)은 버린다. */
function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : '';
}

/** 모델 응답을 후보 목록으로 바꾼다. 규칙을 어긴 항목은 채우지 않고 버린다. */
export function parseReceipt(content: string): ReceiptScanResult {
  const empty: ReceiptScanResult = { store: '', total: 0, drafts: [], dropped: 0 };
  let body: { store?: unknown; total?: unknown; items?: unknown };
  try {
    body = JSON.parse(content);
  } catch {
    return empty;
  }
  if (!body || !Array.isArray(body.items)) return empty;

  const drafts: ReceiptDraft[] = [];
  for (const raw of body.items as Record<string, unknown>[]) {
    const title = typeof raw?.['title'] === 'string' ? raw['title'].trim().slice(0, MAX_TITLE) : '';
    if (!title || !validAmount(raw['amount']) || drafts.length >= MAX_ITEMS) continue;
    const category = String(raw['category']);
    drafts.push({
      title,
      amount: raw['amount'],
      date: validDate(raw['date']),
      category: category in EXPENSE_CATEGORIES ? category : 'other',
      checked: true,
    });
  }
  return {
    store: typeof body.store === 'string' ? body.store.trim().slice(0, MAX_TITLE) : '',
    total: validAmount(body.total) ? body.total : 0,
    drafts,
    dropped: body.items.length - drafts.length,
  };
}

export interface DraftSaveOptions {
  people: readonly ExpensePerson[];
  paidBy: string;
  personal: boolean;
  /** 체크한 항목을 합계 한 건으로 저장한다. */
  merge: boolean;
  mergedTitle: string;
  /** 사진에 날짜가 없을 때 쓸 날짜. */
  fallbackDate: string;
}

/** 체크한 후보를 지출로 바꾼다. 분담은 정산할 사람 전원 균등이다. */
export function draftsToExpenses(
  drafts: readonly ReceiptDraft[],
  options: DraftSaveOptions,
): Expense[] {
  const chosen = drafts.filter((d) => d.checked);
  if (!chosen.length) return [];
  const rows: Omit<ReceiptDraft, 'checked'>[] = options.merge
    ? [
        {
          title: options.mergedTitle.trim() || chosen[0].title,
          amount: chosen.reduce((n, d) => n + d.amount, 0),
          date: chosen.find((d) => d.date)?.date ?? '',
          category: mostCommon(chosen.map((d) => d.category)),
        },
      ]
    : chosen;
  const ids = options.people.map((p) => p.id);
  return rows.map((row) => ({
    id: crypto.randomUUID(),
    title: row.title.trim(),
    amount: row.amount,
    date: row.date || options.fallbackDate,
    category: row.category,
    paidBy: options.paidBy,
    splits: options.personal ? [] : allocateEvenly(row.amount, ids),
    memo: RECEIPT_MEMO,
    linkId: null,
    personal: options.personal,
  }));
}

function mostCommon(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}
