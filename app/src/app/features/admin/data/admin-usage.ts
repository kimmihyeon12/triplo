import { inject, Injectable } from '@angular/core';
import { ADMIN_SUPPORT_CLIENT } from './admin-support';
import { toUsageSummary, type UsageSummary } from '../model/usage';

/** 관리자 사용량 화면의 서버 창구. 관리자가 아니면 서버가 42501로 거절한다. */
@Injectable({ providedIn: 'root' })
export class AdminUsage {
  private readonly client = inject(ADMIN_SUPPORT_CLIENT);

  async summary(): Promise<UsageSummary> {
    return toUsageSummary(await this.client.call('admin_usage_summary', {}));
  }
}
