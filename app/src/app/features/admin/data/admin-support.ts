import { inject, Injectable, InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthStore } from '../../auth/data/auth-store';
import {
  INQUIRY_COLUMNS,
  NOTICE_COLUMNS,
  SupportError,
  toSupportError,
} from '../../support/data/support-data-client';
import { toInquiry, toNotice, type InquiryRow, type NoticeRow } from '../../support/data/support-rows';
import type { InquiryStatus, Notice } from '../../support/model/support';
import type { AdminInquiry } from '../model/admin-support';

/** 관리자 화면의 Supabase 창구. 초안 공지와 모든 문의는 서버 RLS가 관리자에게만 내려 준다. */
export interface AdminSupportClient {
  notices(): Promise<NoticeRow[]>;
  inquiries(): Promise<InquiryRow[]>;
  call(fn: string, args: Record<string, unknown>): Promise<unknown>;
}

export function supabaseAdminSupportClient(client: () => Promise<SupabaseClient>): AdminSupportClient {
  return {
    async notices() {
      const { data, error } = await (await client())
        .from('notices')
        .select(NOTICE_COLUMNS)
        .order('updated_at', { ascending: false });
      if (error) throw toSupportError(error);
      return (data ?? []) as NoticeRow[];
    },
    async inquiries() {
      const { data, error } = await (await client())
        .from('inquiries')
        .select(INQUIRY_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw toSupportError(error);
      return (data ?? []) as InquiryRow[];
    },
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      if (error) throw toSupportError(error);
      return data;
    },
  };
}

export const ADMIN_SUPPORT_CLIENT = new InjectionToken<AdminSupportClient>('ADMIN_SUPPORT_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const auth = inject(AuthStore);
    return supabaseAdminSupportClient(() => auth.dataClient());
  },
});

/** 관리자 권한이 사라져 서버가 거절했는지. 화면은 이 경우 내 정보로 보낸다. */
export function isAdminDenied(error: unknown): boolean {
  return error instanceof SupportError && error.code === '42501';
}

/** 다른 관리자가 지웠거나 없는 대상이다. */
export function isAdminMissing(error: unknown): boolean {
  return error instanceof SupportError && error.code === 'P0404';
}

/** 처리할 것부터 보인다. 접수됨 → 확인 중 → 답변 완료. */
const STATUS_ORDER: Record<InquiryStatus, number> = { open: 0, reading: 1, answered: 2 };

@Injectable({ providedIn: 'root' })
export class AdminSupport {
  private readonly client = inject(ADMIN_SUPPORT_CLIENT);

  async notices(): Promise<Notice[]> {
    return (await this.client.notices()).map(toNotice);
  }

  async notice(id: string): Promise<Notice | null> {
    return (await this.notices()).find((x) => x.id === id) ?? null;
  }

  async saveNotice(id: string | null, title: string, body: string): Promise<string> {
    return (await this.client.call('admin_save_notice', {
      p_id: id,
      p_title: title.trim(),
      p_body: body.trim(),
    })) as string;
  }

  async setPublished(id: string, published: boolean): Promise<void> {
    await this.client.call('admin_set_notice_published', { p_id: id, p_published: published });
  }

  async deleteNotice(id: string): Promise<void> {
    await this.client.call('admin_delete_notice', { p_id: id });
  }

  async inquiries(): Promise<AdminInquiry[]> {
    return (await this.client.inquiries())
      .map((row) => ({ ...toInquiry(row), senderNickname: row.sender_nickname }))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
  }

  async inquiry(id: string): Promise<AdminInquiry | null> {
    return (await this.inquiries()).find((x) => x.id === id) ?? null;
  }

  async reply(id: string, body: string): Promise<void> {
    await this.client.call('admin_reply_inquiry', { p_id: id, p_body: body.trim() });
  }

  async setStatus(id: string, status: InquiryStatus): Promise<void> {
    await this.client.call('admin_set_inquiry_status', { p_id: id, p_status: status });
  }
}
