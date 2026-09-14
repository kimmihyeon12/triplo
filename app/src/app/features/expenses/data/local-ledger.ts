import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import type { Ledger } from '../model/ledger';
import { newLedger, validateLedger } from '../util/ledger';

@Injectable({ providedIn: 'root' })
export class LocalLedger {
  read(id: string): Ledger {
    const raw = localStorage.getItem(`${environment.storageKey}.ledger.${id}`);
    if (!raw) return { ...newLedger(), people: [{ id: 'self', name: '나' }] };
    try {
      const value = JSON.parse(raw) as Ledger;
      if (validateLedger(value)) throw new Error();
      return value;
    } catch {
      throw new Error('가계부를 읽지 못했어요. 기존 기록을 보호하기 위해 저장을 멈췄어요.');
    }
  }

  save(id: string, ledger: Ledger): void {
    const error = validateLedger(ledger);
    if (error) throw new Error(error);
    localStorage.setItem(`${environment.storageKey}.ledger.${id}`, JSON.stringify(ledger));
  }
}
