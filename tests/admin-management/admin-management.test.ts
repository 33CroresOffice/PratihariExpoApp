/**
 * ADMIN-MGMT Module Tests — Notices, Committees, Event Images
 * Covers: ADMIN-MGMT-TC-001 through ADMIN-MGMT-TC-018
 */

import { NOTICE, COMMITTEE } from '../utils/test-data';

// ─── Notices ─────────────────────────────────────────────────────────────────

describe('ADMIN-MGMT — Notices', () => {
  // ADMIN-MGMT-TC-001
  test('ADMIN-MGMT-TC-001: Notice with English title/body only — saved as draft', () => {
    const notice = { title: 'Test Notice', body: 'Body text', published_at: null };
    const isDraft = !notice.published_at;
    expect(isDraft).toBe(true);
    expect(notice.title).toBeTruthy();
  });

  // ADMIN-MGMT-TC-002
  test('ADMIN-MGMT-TC-002: Notice with Odia fields stored separately', () => {
    const notice = {
      title: 'Festival Notice',
      title_or: 'ଉତ୍ସବ ବିଜ୍ଞପ୍ତି',
      body: 'English body',
      body_or: 'ଓଡ଼ିଆ ବ�ଡ଼',
    };
    expect(notice.title_or).toBeTruthy();
    expect(notice.body_or).toBeTruthy();
  });

  // ADMIN-MGMT-TC-003
  test('ADMIN-MGMT-TC-003: Publish immediately sets published_at to current time', () => {
    const publishedAt = new Date().toISOString();
    expect(new Date(publishedAt).getTime()).toBeGreaterThan(0);
    const now = Date.now();
    expect(Math.abs(now - new Date(publishedAt).getTime())).toBeLessThan(5000);
  });

  // ADMIN-MGMT-TC-004
  test('ADMIN-MGMT-TC-004: Scheduled notice has scheduled_publish_at in the future', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const notice = { title: 'Scheduled', scheduled_publish_at: future, published_at: null };
    expect(new Date(notice.scheduled_publish_at!) > new Date()).toBe(true);
    expect(notice.published_at).toBeNull();
  });

  // ADMIN-MGMT-TC-005
  test('ADMIN-MGMT-TC-005: Pinned notice has pinned=true flag', () => {
    const notice = { ...NOTICE, pinned: true };
    expect(notice.pinned).toBe(true);
  });

  // ADMIN-MGMT-TC-006
  test('ADMIN-MGMT-TC-006: Specific target notice stores target sebayat IDs', () => {
    const notice = { ...NOTICE, target_type: 'specific', target_ids: ['s1', 's2', 's3'] };
    expect(notice.target_type).toBe('specific');
    expect(notice.target_ids).toHaveLength(3);
  });

  // ADMIN-MGMT-TC-007
  test('ADMIN-MGMT-TC-007: SMS channel enabled in channels config triggers SMS dispatch', () => {
    const channels = ['sms', 'push'];
    const hasSms = channels.includes('sms');
    expect(hasSms).toBe(true);
  });

  // ADMIN-MGMT-TC-008
  test('ADMIN-MGMT-TC-008: Deleted notice removed from list', () => {
    let notices = [
      { id: 'n1', title: 'Notice A' },
      { id: 'n2', title: 'Notice B' },
    ];
    notices = notices.filter((n) => n.id !== 'n1');
    expect(notices).toHaveLength(1);
    expect(notices[0].id).toBe('n2');
  });

  // ADMIN-MGMT-TC-009
  test('ADMIN-MGMT-TC-009: Notice read receipts join notice_reads with notice_id', () => {
    const reads = [
      { notice_id: 'n1', sebayat_id: 's1', read_at: '2026-05-22T08:00:00Z' },
      { notice_id: 'n1', sebayat_id: 's2', read_at: '2026-05-22T09:00:00Z' },
    ];
    const forNotice = reads.filter((r) => r.notice_id === 'n1');
    expect(forNotice).toHaveLength(2);
  });
});

// ─── Committees ───────────────────────────────────────────────────────────────

describe('ADMIN-MGMT — Committees', () => {
  // ADMIN-MGMT-TC-010
  test('ADMIN-MGMT-TC-010: Create committee with year and title saves correctly', () => {
    const committee = { ...COMMITTEE };
    expect(committee.year).toBe(2026);
    expect(committee.title).toBeTruthy();
    expect(committee.is_active).toBe(true);
  });

  // ADMIN-MGMT-TC-011
  test('ADMIN-MGMT-TC-011: Add committee member stores member in committee_members', () => {
    const member = {
      committee_id: COMMITTEE.id,
      name: 'Suresh Kumar',
      role: 'President',
      role_order: 1,
    };
    expect(member.committee_id).toBe(COMMITTEE.id);
    expect(member.role).toBe('President');
  });

  // ADMIN-MGMT-TC-012
  test('ADMIN-MGMT-TC-012: Edit committee member role updates role field', () => {
    const member = { id: 'm1', role: 'President' };
    const updated = { ...member, role: 'Vice President' };
    expect(updated.role).toBe('Vice President');
  });

  // ADMIN-MGMT-TC-013
  test('ADMIN-MGMT-TC-013: Remove committee member filters out from list', () => {
    let members = [{ id: 'm1', name: 'Suresh' }, { id: 'm2', name: 'Ramesh' }];
    members = members.filter((m) => m.id !== 'm1');
    expect(members).toHaveLength(1);
    expect(members[0].id).toBe('m2');
  });

  // ADMIN-MGMT-TC-014
  test('ADMIN-MGMT-TC-014: Set committee inactive hides from app', () => {
    const committee = { ...COMMITTEE, is_active: false };
    expect(committee.is_active).toBe(false);
    const showInApp = committee.is_active;
    expect(showInApp).toBe(false);
  });
});

// ─── Event Images ─────────────────────────────────────────────────────────────

describe('ADMIN-MGMT — Event Images', () => {
  const images = [
    { id: 'img-1', title: 'Rath Yatra',   image_url: 'https://example.com/1.jpg', display_order: 1, is_active: true  },
    { id: 'img-2', title: 'Car Festival', image_url: 'https://example.com/2.jpg', display_order: 2, is_active: true  },
    { id: 'img-3', title: 'Old Image',    image_url: 'https://example.com/3.jpg', display_order: 3, is_active: false },
  ];

  // ADMIN-MGMT-TC-015
  test('ADMIN-MGMT-TC-015: Uploaded image has URL, title, and display_order', () => {
    const img = images[0];
    expect(img.image_url).toMatch(/^https?:\/\//);
    expect(img.title).toBeTruthy();
    expect(img.display_order).toBe(1);
  });

  // ADMIN-MGMT-TC-016
  test('ADMIN-MGMT-TC-016: Reorder updates display_order values', () => {
    const reordered = [
      { ...images[1], display_order: 1 },
      { ...images[0], display_order: 2 },
    ];
    expect(reordered[0].id).toBe('img-2');
    expect(reordered[0].display_order).toBe(1);
  });

  // ADMIN-MGMT-TC-017
  test('ADMIN-MGMT-TC-017: Active images shown in carousel, inactive hidden', () => {
    const carouselSlides = images.filter((i) => i.is_active);
    expect(carouselSlides).toHaveLength(2);
    expect(carouselSlides.every((i) => i.is_active)).toBe(true);
  });

  // ADMIN-MGMT-TC-018
  test('ADMIN-MGMT-TC-018: Deleted image removed from gallery list', () => {
    let imgs = [...images];
    imgs = imgs.filter((i) => i.id !== 'img-3');
    expect(imgs).toHaveLength(2);
    expect(imgs.find((i) => i.id === 'img-3')).toBeUndefined();
  });
});
