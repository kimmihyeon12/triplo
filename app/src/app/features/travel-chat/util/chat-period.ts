import { addDays, isIsoDate } from '../../../shared/util/dates';

/**
 * 대화에서 여행 기간을 읽는다(2026-10-01 사용자 지적: '내일부터 2박3일'이라고 했는데
 * 새 여행에 날짜가 들어가지 않았다). 시작일과 길이를 모두 알 때만 기간을 낸다.
 * 날짜 계산은 기기 날짜(today) 기준이며 모델에게 맡기지 않는다.
 */
export interface ChatPeriod {
  readonly start: string;
  readonly end: string;
}

const pad = (n: number | string) => String(n).padStart(2, '0');

/** 월·일로 날짜를 만든다. 오늘보다 앞이면 내년으로 본다. */
function monthDay(month: number, day: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  let date = `${year}-${pad(month)}-${pad(day)}`;
  if (!isIsoDate(date)) return null;
  if (date < today) date = `${year + 1}-${pad(month)}-${pad(day)}`;
  return isIsoDate(date) ? date : null;
}

/** 'N박M일'·'당일치기'에서 묵는 밤 수. 없으면 null. */
function nightsOf(text: string): number | null {
  if (/당일\s*치기|당일/.test(text)) return 0;
  const match = /(\d+)\s*박\s*(\d+)\s*일/.exec(text);
  return match ? Number(match[1]) : null;
}

/** 오늘 기준 이번 주(또는 다음 주) 토요일. */
function saturday(today: string, weeksAhead: number): string {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, ((6 - day + 7) % 7) + 7 * weeksAhead);
}

export function chatPeriod(text: string, today: string): ChatPeriod | null {
  const nights = nightsOf(text);

  // 'N월 N일부터 (N월)? M일까지'
  const range = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*부터\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일\s*까지/.exec(text);
  if (range) {
    const start = monthDay(Number(range[1]), Number(range[2]), today);
    const endMonth = Number(range[3] ?? range[1]);
    let end = start ? `${start.slice(0, 4)}-${pad(endMonth)}-${pad(range[4]!)}` : null;
    if (start && end && end < start) end = `${Number(start.slice(0, 4)) + 1}-${pad(endMonth)}-${pad(range[4]!)}`;
    return start && end && isIsoDate(end) ? { start, end } : null;
  }

  // 시작일: 오늘·내일·모레, 'N월 N일부터', 이번·다음 주말
  let start: string | null = null;
  if (/모레/.test(text)) start = addDays(today, 2);
  else if (/내일/.test(text)) start = addDays(today, 1);
  else if (/오늘/.test(text)) start = today;
  const dated = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text);
  if (!start && dated) start = monthDay(Number(dated[1]), Number(dated[2]), today);
  const weekend = /(이번|다음)\s*주\s*말/.exec(text);
  if (!start && weekend) {
    start = saturday(today, weekend[1] === '다음' ? 1 : 0);
    return { start, end: addDays(start, nights ?? 1) };
  }
  if (!start || nights === null) return null;
  return { start, end: addDays(start, nights) };
}
