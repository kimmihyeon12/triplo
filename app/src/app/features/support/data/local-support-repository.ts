import { APP_VERSION } from '../../../core/version';
import type { Inquiry, InquiryKind, Notice } from '../model/support';
import type { SupportRepository } from './support-repository';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface SupportFile {
  version: 1;
  inquiries: Inquiry[];
  /** 마지막으로 공지를 읽은 시각. 이보다 나중 공지가 '안 읽음'이다. */
  noticesReadAt: string | null;
}

const EMPTY: SupportFile = { version: 1, inquiries: [], noticesReadAt: null };

/**
 * 서버를 붙이기 전까지 쓰는 기기 저장 구현.
 *
 * 공지는 아직 쓸 곳이 없어 화면을 확인할 표본을 돌려준다. 문의는 실제로
 * 저장되지만 이 기기에만 남고 관리자에게 가지 않는다. 화면에서 그 사실을
 * 알린다.
 */
export class LocalSupportRepository implements SupportRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
  ) {}

  private read(): SupportFile {
    const raw = this.storage.getItem(this.key);
    if (!raw) return { ...EMPTY, inquiries: [] };
    try {
      const parsed = JSON.parse(raw) as SupportFile;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.inquiries)) {
        return { ...EMPTY, inquiries: [] };
      }
      return { version: 1, inquiries: parsed.inquiries, noticesReadAt: parsed.noticesReadAt ?? null };
    } catch {
      // 손상된 값 때문에 화면이 열리지 않는 편보다, 비우고 여는 편이 낫다.
      return { ...EMPTY, inquiries: [] };
    }
  }

  private write(next: SupportFile): void {
    this.storage.setItem(this.key, JSON.stringify(next));
  }

  async notices(): Promise<Notice[]> {
    return SAMPLE_NOTICES;
  }

  async unreadNoticeCount(): Promise<number> {
    const readAt = this.read().noticesReadAt;
    if (!readAt) return SAMPLE_NOTICES.length;
    // 읽은 시각보다 나중에 올라온 것만 센다. 같은 시각이면 읽은 것으로 본다.
    return SAMPLE_NOTICES.filter((n) => (n.publishedAt ?? n.createdAt) > readAt).length;
  }

  /** 지금 읽지 않은 공지의 id. 목록 화면의 새 소식 표시에 쓴다. */
  async unreadNoticeIds(): Promise<string[]> {
    const readAt = this.read().noticesReadAt;
    if (!readAt) return SAMPLE_NOTICES.map((n) => n.id);
    return SAMPLE_NOTICES.filter((n) => (n.publishedAt ?? n.createdAt) > readAt).map((n) => n.id);
  }

  async markNoticesRead(): Promise<void> {
    const file = this.read();
    this.write({ ...file, noticesReadAt: new Date().toISOString() });
  }

  async inquiries(): Promise<Inquiry[]> {
    return [...this.read().inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async unansweredReadCount(): Promise<number> {
    return this.read().inquiries.filter((i) => i.replies.length > 0 && !i.readAt).length;
  }

  async sendInquiry(kind: InquiryKind, body: string): Promise<Inquiry> {
    const file = this.read();
    const inquiry: Inquiry = {
      id: crypto.randomUUID(),
      kind,
      body,
      status: 'open',
      createdAt: new Date().toISOString(),
      appVersion: APP_VERSION.name,
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      replies: [],
      readAt: null,
    };
    this.write({ ...file, inquiries: [...file.inquiries, inquiry] });
    return inquiry;
  }

  async markInquiryRead(id: string): Promise<void> {
    const file = this.read();
    const now = new Date().toISOString();
    this.write({
      ...file,
      inquiries: file.inquiries.map((i) => (i.id === id ? { ...i, readAt: now } : i)),
    });
  }
}

/**
 * 화면을 확인하기 위한 표본 공지.
 *
 * 서버가 붙으면 이 배열을 지우고 실제 목록을 읽는다. 내용은 실제 배포에서
 * 있었던 일로 적어, 자동 생성 공지가 어떤 말투가 되어야 하는지 보여준다.
 */
const SAMPLE_NOTICES: Notice[] = [
  {
    id: 'sample-3',
    title: '이번 업데이트에서 달라진 것',
    body: '내 정보 화면에서 지금 쓰는 앱이 어느 버전인지 볼 수 있어요. 파란 버튼 가장자리에 보이던 회색 선도 없앴습니다.',
    status: 'published',
    generated: true,
    releaseTag: 'v0.1.1',
    createdAt: '2026-09-17T05:00:00.000Z',
    publishedAt: '2026-09-17T05:00:00.000Z',
  },
  {
    id: 'sample-2',
    title: '뒤로 가기가 들어온 길을 되짚어요',
    body: '날짜 탭을 옮긴 뒤 뒤로 가기를 눌러도 여행 상세를 벗어납니다. 상단 바의 ‹ 와 기기의 뒤로 가기 제스처가 같게 움직입니다.',
    status: 'published',
    generated: true,
    releaseTag: 'v0.1.0',
    createdAt: '2026-09-16T08:00:00.000Z',
    publishedAt: '2026-09-16T08:00:00.000Z',
  },
  {
    id: 'sample-1',
    title: '일정을 이미지로 저장할 수 있어요',
    body: '여행 상세의 더보기에서 일정을 이미지로 내려받습니다. 전체 또는 고른 날짜만 담을 수 있고, 예상 비용을 넣을지 고를 수 있어요.',
    status: 'published',
    generated: false,
    releaseTag: '',
    createdAt: '2026-09-14T02:00:00.000Z',
    publishedAt: '2026-09-14T02:00:00.000Z',
  },
];
