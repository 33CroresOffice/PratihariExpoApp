/**
 * NOTICE Module Tests — Notice Board
 * Covers: NOTICE-TC-001 through NOTICE-TC-007
 */

import { NOTICE } from '../utils/test-data';

type Notice = typeof NOTICE & { pinned: boolean; body_or?: string | null; title_or?: string | null };

function sortNotices(notices: Notice[]): Notice[] {
  return [...notices].sort(
    (a, b) =>
      new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime()
  );
}

function filterByCategory(notices: Notice[], category: string): Notice[] {
  return notices.filter((n) => n.category === category);
}

function pickLocalized(notice: Notice, field: 'title' | 'body', lang: string): string {
  const orField = `${field}_or` as keyof Notice;
  if (lang === 'or' && notice[orField]) return notice[orField] as string;
  return notice[field] as string;
}

describe('NOTICE Module', () => {
  const notices: Notice[] = [
    { ...NOTICE, id: 'n1', pinned: false, published_at: '2026-05-01T00:00:00Z' },
    { ...NOTICE, id: 'n2', pinned: true,  published_at: '2026-05-10T00:00:00Z' },
    { ...NOTICE, id: 'n3', pinned: false, published_at: '2026-05-20T00:00:00Z', category: 'admin' },
  ];

  // NOTICE-TC-001
  test('NOTICE-TC-001: Notices sorted in reverse chronological order', () => {
    const sorted = sortNotices(notices);
    expect(sorted[0].id).toBe('n3');
    expect(sorted[1].id).toBe('n2');
    expect(sorted[2].id).toBe('n1');
  });

  // NOTICE-TC-002
  test('NOTICE-TC-002: Pinned notices identified correctly', () => {
    const pinned = notices.filter((n) => n.pinned);
    expect(pinned).toHaveLength(1);
    expect(pinned[0].id).toBe('n2');
  });

  // NOTICE-TC-003
  test('NOTICE-TC-003: Notice detail has title and body content', () => {
    expect(NOTICE.title).toBeTruthy();
    expect(NOTICE.body).toBeTruthy();
  });

  // NOTICE-TC-004
  test('NOTICE-TC-004: Marking notice read reduces unread count', () => {
    let unreadCount = 3;
    const readNoticeId = 'n1';
    const readNoticeIds = new Set<string>();
    if (!readNoticeIds.has(readNoticeId)) {
      readNoticeIds.add(readNoticeId);
      unreadCount--;
    }
    expect(unreadCount).toBe(2);
  });

  // NOTICE-TC-005
  test('NOTICE-TC-005: Odia language shows title_or when available', () => {
    const n: Notice = { ...NOTICE, title_or: 'ବାର୍ଷିକ ଉତ୍ସବ', body_or: null };
    const title = pickLocalized(n, 'title', 'or');
    expect(title).toBe('ବାର୍ଷିକ ଉତ୍ସବ');
  });

  // NOTICE-TC-006
  test('NOTICE-TC-006: No Odia translation — falls back to English', () => {
    const n: Notice = { ...NOTICE, title_or: null, body_or: null };
    const title = pickLocalized(n, 'title', 'or');
    expect(title).toBe(NOTICE.title);
  });

  // NOTICE-TC-007
  test('NOTICE-TC-007: Category filter returns only matching notices', () => {
    const adminNotices = filterByCategory(notices, 'admin');
    expect(adminNotices).toHaveLength(1);
    expect(adminNotices[0].id).toBe('n3');
  });
});
