import { isIsoDate, todayIso } from '../../../shared/util/dates';
import type { Ledger } from '../../expenses/model/ledger';
import { validMoney, validateLedger } from '../../expenses/util/ledger';
import { newId } from '../../trips/util/factories';
import type { Trip } from '../../trips/model/trip';
import type { LocalResult } from './local-command-draft';

export function isLedgerCommand(text: string): boolean {
  if (/추천|갈 만|여행지|일정 짜|일정 만들어/.test(text)) return false;
  return /예산|지출|가계부|경비|총비용|얼마 썼|얼마나 썼|\d\s*(?:만|천)?\s*원/.test(text);
}

function money(raw: string): number | null {
  const clean = raw.replace(/[\s,]/g, '');
  const match = clean.match(/^(?:(\d+)만)?(?:(\d+)천)?(\d+)?$/);
  if (!match || !clean) return null;
  const value = Number(match[1] ?? 0) * 10000 + Number(match[2] ?? 0) * 1000 + Number(match[3] ?? 0);
  return validMoney(value) ? value : null;
}

export function ledgerCommand(text: string, trip: Trip, ledger: Ledger, today = todayIso()): LocalResult | null {
  if (!isLedgerCommand(text)) return null;
  const link = `/trips/${encodeURIComponent(trip.id)}/expenses`;
  const help = (message: string): LocalResult => ({ text: message, localLink: link });
  if (/열어/.test(text)) return help('여행 가계부를 열 수 있어요.');
  if (/말고|빼고|하지|않|아니|대신|그리고|[-−]/.test(text.replace(/\d{4}-\d{2}-\d{2}/g, ''))) return help('금액과 작업을 하나씩 명확히 알려 주세요.');
  const total = ledger.expenses.reduce((sum, e) => sum + e.amount, 0);
  const draft = (after: Ledger, title: string): LocalResult => {
    const error = validateLedger(after);
    if (error) return help(error);
    return { text: `${title}. 금액과 날짜를 확인한 뒤 적용해 주세요.`, draft: { action: 'local-change', title, before: trip, after: trip, ledger: {before: ledger, after} } };
  };
  const division = text.match(/^(?:총비용|지출 합계) (\d+)명(?:이|으로)? (?:똑같이 )?(?:나누면|나눠줘)[?!.]*$/);
  if (division) {
    const count = Number(division[1]);
    if (count < 1 || count > 1000) return help('나눌 인원은 1~1000명으로 입력해 주세요.');
    const each = Math.floor(total / count), remainder = total % count;
    return { text: `저장된 지출 ${total.toLocaleString()}원 ÷ ${count}명 = 1인 ${each.toLocaleString()}원${remainder ? `, ${remainder}명은 1원씩 추가` : ''}. 균등 계산이며 실제 결제·정산 기록은 바꾸지 않았어요.` };
  }
  if (/예산/.test(text) && /남|얼마|보여|알려/.test(text)) return {text: ledger.budget === null ? '예산이 미정이에요.' : `예산 ${ledger.budget.toLocaleString()}원 · 실제 지출 ${total.toLocaleString()}원 · 잔액 ${(ledger.budget - total).toLocaleString()}원`};
  if (/얼마 썼|얼마나 썼|지출.*(?:합계|보여|알려)|총비용.*(?:얼마|알려)/.test(text)) {
    const dates = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(m => m[0]);
    if (text.includes('오늘')) dates.push(today);
    if (new Set(dates).size > 1 || dates.some(d => !isIsoDate(d))) return help('조회할 날짜를 하나만 지정해 주세요.');
    if (/일차|어제|내일|식비|숙박비|교통비/.test(text)) return help('지출 조회는 전체 또는 오늘·YYYY-MM-DD 날짜로 지정해 주세요.');
    const expenses = dates.length ? ledger.expenses.filter(e => e.date === dates[0]) : ledger.expenses;
    return {text: `${dates[0] ?? '전체'} 지출 ${expenses.reduce((sum,e) => sum + e.amount, 0).toLocaleString()}원 · ${expenses.length}건\n${expenses.map(e => `${e.title}: ${e.amount.toLocaleString()}원`).join('\n')}`};
  }
  const budget = text.match(/^예산(?:을)? ([\d,\s만천]+)원(?:으로|로)? (?:바꿔|설정해|수정해)(?:줘)?$/);
  if (budget) {
    const amount = money(budget[1]);
    return amount === null ? help('올바른 원화 금액을 입력해 주세요.') : draft({...ledger, budget: amount}, `예산 ${amount.toLocaleString()}원`);
  }
  const remove = text.match(/^(?:지출 )?(.+?)\s*(?:지출을? )?(?:삭제해|지워)(?:줘)?$/);
  if (remove) {
    const found = ledger.expenses.filter(e => e.title === remove[1].trim());
    if (found.length !== 1) return help('지출 이름이 없거나 여러 건이에요. 가계부에서 삭제할 기록을 선택해 주세요.');
    return draft({...ledger, expenses: ledger.expenses.filter(e => e.id !== found[0].id)}, `${found[0].title} 지출 삭제`);
  }
  const edit = text.match(/^(?:지출 )?(.+?)\s+([\d,\s만천]+)원(?:으로|로)?\s+(추가해|기록해|수정해|바꿔)(?:줘)?$/);
  if (edit) {
    const amount = money(edit[2]);
    if (!amount) return help('지출 금액은 1원 이상의 정수로 입력해 주세요.');
    let title = edit[1].trim();
    const dateMatch = title.match(/^(오늘|\d{4}-\d{2}-\d{2})\s+/);
    const date = dateMatch ? dateMatch[1] === '오늘' ? today : dateMatch[1] : today;
    if (dateMatch) title = title.slice(dateMatch[0].length);
    if (!isIsoDate(date) || /어제|내일|일차|방금/.test(title)) return help('날짜는 오늘 또는 YYYY-MM-DD로, 지출은 정확한 이름으로 지정해 주세요.');
    if (/추가해|기록해/.test(edit[3])) {
      if (ledger.people.length !== 1) return help('결제자와 분담 대상을 선택해야 해요. 가계부에서 지출을 추가해 주세요.');
      const person = ledger.people[0].id;
      return draft({...ledger, expenses: [...ledger.expenses, {id: newId(), title, date, category: 'other', amount, paidBy: person, splits: [{personId: person, amount}], memo: '', linkId: null}]}, `${title} ${amount.toLocaleString()}원 기록 · 결제자 ${ledger.people[0].name} · 분류 기타`);
    }
    const found = ledger.expenses.filter(e => e.title === title && (!dateMatch || e.date === date));
    if (found.length !== 1) return help('지출 이름이 없거나 여러 건이에요. 가계부에서 수정할 기록을 선택해 주세요.');
    const target = found[0];
    if (!target.personal && target.splits.length !== 1) return help('여러 명의 분담 금액이 연결되어 있어요. 가계부에서 함께 수정해 주세요.');
    return draft({...ledger, expenses: ledger.expenses.map(e => e.id === target.id ? {...e, amount, splits: e.personal ? e.splits : [{...e.splits[0], amount}]} : e)}, `${title} ${amount.toLocaleString()}원으로 수정`);
  }
  return help('가계부 명령 예: 지출 합계 알려줘 / 점심값 20000원 추가해 / 예산 30만원으로 설정해');
}
