export interface ExpensePerson {
  id: string;
  name: string;
}
export interface ExpenseSplit {
  personId: string;
  amount: number;
}
export interface Expense {
  id: string;
  title: string;
  date: string;
  category: string;
  amount: number;
  paidBy: string;
  splits: ExpenseSplit[];
  memo: string;
  linkId: string | null;
  personal?: boolean;
}
export interface SettlementReceipt {
  id: string;
  from: string;
  to: string;
  amount: number;
  cancelledReason: string | null;
}
export interface Ledger {
  people: ExpensePerson[];
  expenses: Expense[];
  receipts: SettlementReceipt[];
  budget: number | null;
}
export const EXPENSE_CATEGORIES = {
  food: '식비',
  stay: '숙박',
  transport: '교통',
  activity: '관광·활동',
  shopping: '쇼핑',
  other: '기타',
};
