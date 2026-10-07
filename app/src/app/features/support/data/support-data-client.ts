import type { SupabaseClient } from '@supabase/supabase-js';
import type { InquiryRow, NoticeRow } from './support-rows';

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface SupportDataClient {
  publishedNotices(): Promise<NoticeRow[]>;
  readNoticeIds(): Promise<string[]>;
  myInquiries(): Promise<InquiryRow[]>;
  call(fn: string, args?: Record<string, unknown>): Promise<unknown>;
}

/** 서버 오류를 사용자 문장으로 바꾼 것. code는 권한이 사라진 경우 등을 화면이 구분할 때 쓴다. */
export class SupportError extends Error {
  constructor(
    message: string,
    readonly code = '',
  ) {
    super(message);
  }
}

/** 서버 오류 코드: P0400 길이·값, P0404 없는 대상, P0429 문의 횟수 초과, 42501 권한 없음. */
export function toSupportError(error: { code?: string } | null): SupportError {
  if (error?.code === 'P0400') return new SupportError('입력 길이를 확인해 주세요.');
  if (error?.code === 'P0429') return new SupportError('문의를 너무 자주 보냈어요. 1시간 뒤에 다시 보내 주세요.', 'P0429');
  if (error?.code === 'P0404') return new SupportError('이미 지워졌거나 볼 수 없는 항목이에요.', 'P0404');
  if (error?.code === '42501') return new SupportError('권한이 없어요. 다시 로그인해 주세요.', '42501');
  return new SupportError('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

export const NOTICE_COLUMNS = 'id, title, body, status, generated, release_tag, created_at, published_at';
export const INQUIRY_COLUMNS =
  'id, user_id, sender_nickname, kind, body, status, app_version, user_agent, answer_read_at, created_at, inquiry_replies(id, body, author_role, created_at)';

export function supabaseSupportDataClient(client: () => Promise<SupabaseClient>): SupportDataClient {
  return {
    async publishedNotices() {
      // RLS는 관리자에게 초안도 내려 준다. 사용자 화면에서는 관리자도 발행된 것만 본다.
      const { data, error } = await (await client())
        .from('notices')
        .select(NOTICE_COLUMNS)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw toSupportError(error);
      return (data ?? []) as NoticeRow[];
    },
    async readNoticeIds() {
      const { data, error } = await (await client()).from('notice_reads').select('notice_id');
      if (error) throw toSupportError(error);
      return (data ?? []).map((r) => (r as { notice_id: string }).notice_id);
    },
    async myInquiries() {
      const db = await client();
      const { data: session } = await db.auth.getSession();
      const userId = session.session?.user.id;
      // 로그인이 풀렸으면 볼 문의가 없다. 빈 id로 조회하면 서버가 형식 오류를 낸다.
      if (!userId) return [];
      // 관리자도 사용자 화면에서는 자기 문의만 본다. RLS만 믿으면 관리자에게 전체가 보인다.
      const { data, error } = await db
        .from('inquiries')
        .select(INQUIRY_COLUMNS)
        .eq('user_id', userId);
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
