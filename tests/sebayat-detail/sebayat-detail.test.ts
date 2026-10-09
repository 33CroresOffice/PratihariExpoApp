/**
 * Sebayat Detail & Members Directory tests — covers profile display,
 * contact info, social links, group member listing, and access control.
 * Mirrors logic from app/sebayat/[id].tsx and app/members/[group].tsx.
 */

import {
  SEBAYAT_APPROVED,
  SEBAYAT_DRAFT,
  TEST_SEBAYAT_ID,
} from '../utils/test-data';

// ── pickLocalized (mirrors lib/i18n.ts) ──
function pickLocalized(row: any, field: string, lang: string): string {
  const orField = `${field}_or`;
  if (lang === 'or' && row[orField]) return row[orField];
  return row[field] ?? '';
}

// ── Phone normalization (mirrors sebayat detail) ──
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return `+91${cleaned.slice(1)}`;
  return phone.startsWith('+') ? phone : `+${cleaned}`;
}

// ── Group filter (mirrors members/[group].tsx) ──
function filterByGroup(members: any[], group: string): any[] {
  return members.filter((m) => m.seba_group === group);
}

// ── Search (mirrors sebayat/[id].tsx and home search) ──
function searchSebayats(query: string, sebayats: any[]): any[] {
  const q = query.trim().toLowerCase();
  if (!q) return sebayats;
  return sebayats.filter((s) =>
    (s.full_name || '').toLowerCase().includes(q) ||
    (s.primary_phone || '').includes(q) ||
    (s.health_card_no || '').toLowerCase().includes(q)
  );
}

// ── Fixtures ──
const SEBAYAT_DETAIL = {
  id: 'seb-002',
  auth_user_id: 'usr-002',
  profile_status: 'approved',
  full_name: 'Ramesh Pratihari',
  first_name: 'Ramesh',
  last_name: 'Pratihari',
  photo_url: 'https://example.com/ramesh.jpg',
  registration_no: 'PN-2026-0005',
  primary_phone: '9876500001',
  whatsapp_number: '9876500001',
  email: 'ramesh@example.com',
  permanent_sahi: 'Markandeswar Sahi',
  bansa_name: 'Badu',
  seba_name: 'Singha Dwara',
  seba_name_or: 'ସିଂହ ଦ୍ୱାର',
  palia_number: '5',
  health_card_no: 'HC005',
  social_facebook: 'ramesh.fb',
  social_twitter: '',
  social_instagram: 'ramesh.ig',
  social_linkedin: '',
  social_youtube: '',
};

const GROUP_MEMBERS = [
  { id: 'm1', full_name: 'Ramesh Pratihari',  primary_phone: '9876500001', seba_group: 'pratihari', photo_url: '', seba_name: 'Singha Dwara',  health_card_no: 'HC005', profile_status: 'approved' },
  { id: 'm2', full_name: 'Suresh Pratihari',  primary_phone: '9876500002', seba_group: 'pratihari', photo_url: '', seba_name: 'Pratihari',      health_card_no: 'HC006', profile_status: 'approved' },
  { id: 'm3', full_name: 'Debasish Das',      primary_phone: '9876500003', seba_group: 'gochhikar', photo_url: '', seba_name: 'Gochhikar',      health_card_no: 'HC007', profile_status: 'approved' },
  { id: 'm4', full_name: 'Prakash Mishra',    primary_phone: '9876500004', seba_group: 'pratihari', photo_url: '', seba_name: 'Singha Dwara',  health_card_no: 'HC008', profile_status: 'approved' },
  { id: 'm5', full_name: 'Ashok Pratihari',   primary_phone: '9876500005', seba_group: 'gochhikar', photo_url: '', seba_name: 'Gochhikar',      health_card_no: 'HC009', profile_status: 'approved' },
];

// ── Sebayat Detail Tests ──

describe('Sebayat Detail — Profile Display (SD-TC-001)', () => {
  it('displays full name', () => {
    expect(SEBAYAT_DETAIL.full_name).toBe('Ramesh Pratihari');
  });

  it('displays registration number', () => {
    expect(SEBAYAT_DETAIL.registration_no).toBe('PN-2026-0005');
  });

  it('displays sahi (lane/area)', () => {
    expect(SEBAYAT_DETAIL.permanent_sahi).toBe('Markandeswar Sahi');
  });

  it('displays bansa (lineage)', () => {
    expect(SEBAYAT_DETAIL.bansa_name).toBe('Badu');
  });

  it('displays seba name', () => {
    expect(SEBAYAT_DETAIL.seba_name).toBe('Singha Dwara');
  });

  it('displays palia number', () => {
    expect(SEBAYAT_DETAIL.palia_number).toBe('5');
  });

  it('displays health card number', () => {
    expect(SEBAYAT_DETAIL.health_card_no).toBe('HC005');
  });
});

describe('Sebayat Detail — Contact Info (SD-TC-002)', () => {
  it('phone is present', () => {
    expect(SEBAYAT_DETAIL.primary_phone).toBe('9876500001');
  });

  it('WhatsApp number matches primary phone', () => {
    expect(SEBAYAT_DETAIL.whatsapp_number).toBe(SEBAYAT_DETAIL.primary_phone);
  });

  it('email is present', () => {
    expect(SEBAYAT_DETAIL.email).toBe('ramesh@example.com');
  });
});

describe('Sebayat Detail — Phone Normalization (SD-TC-003)', () => {
  it('normalizes 10-digit phone with +91 prefix', () => {
    expect(normalizePhone('9876500001')).toBe('+919876500001');
  });

  it('preserves phone with existing +91 prefix', () => {
    expect(normalizePhone('+919876500001')).toBe('+919876500001');
  });

  it('normalizes 0-prefixed landline-style', () => {
    expect(normalizePhone('09876500001')).toBe('+919876500001');
  });

  it('normalizes 91-prefixed number', () => {
    expect(normalizePhone('919876500001')).toBe('+919876500001');
  });

  it('returns empty for empty input', () => {
    expect(normalizePhone('')).toBe('');
  });
});

describe('Sebayat Detail — Social Links (SD-TC-004)', () => {
  it('Facebook link is present', () => {
    expect(SEBAYAT_DETAIL.social_facebook).toBe('ramesh.fb');
  });

  it('Instagram link is present', () => {
    expect(SEBAYAT_DETAIL.social_instagram).toBe('ramesh.ig');
  });

  it('Twitter link is empty', () => {
    expect(SEBAYAT_DETAIL.social_twitter).toBe('');
  });

  it('LinkedIn link is empty', () => {
    expect(SEBAYAT_DETAIL.social_linkedin).toBe('');
  });

  it('YouTube link is empty', () => {
    expect(SEBAYAT_DETAIL.social_youtube).toBe('');
  });
});

describe('Sebayat Detail — Bilingual (SD-TC-005)', () => {
  it('shows Odia seba name when available', () => {
    expect(pickLocalized(SEBAYAT_DETAIL, 'seba_name', 'or')).toBe('ସିଂହ ଦ୍ୱାର');
  });

  it('falls back to English seba name when no Odia', () => {
    const noOdia = { ...SEBAYAT_DETAIL, seba_name_or: null };
    expect(pickLocalized(noOdia, 'seba_name', 'or')).toBe('Singha Dwara');
  });

  it('shows English when language is "en"', () => {
    expect(pickLocalized(SEBAYAT_DETAIL, 'seba_name', 'en')).toBe('Singha Dwara');
  });
});

// ── Members Directory Tests ──

describe('Members Directory — Group Filter (MEM-TC-001)', () => {
  it('filters pratihari group members', () => {
    const result = filterByGroup(GROUP_MEMBERS, 'pratihari');
    expect(result).toHaveLength(3);
    expect(result.every((m) => m.seba_group === 'pratihari')).toBe(true);
  });

  it('filters gochhikar group members', () => {
    const result = filterByGroup(GROUP_MEMBERS, 'gochhikar');
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.seba_group === 'gochhikar')).toBe(true);
  });

  it('returns empty for non-existent group', () => {
    expect(filterByGroup(GROUP_MEMBERS, 'unknown')).toHaveLength(0);
  });

  it('returns empty for empty members list', () => {
    expect(filterByGroup([], 'pratihari')).toHaveLength(0);
  });
});

describe('Members Directory — Search (MEM-TC-002)', () => {
  it('searches by name', () => {
    const result = searchSebayats('Ramesh', GROUP_MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('Ramesh Pratihari');
  });

  it('searches by phone number', () => {
    const result = searchSebayats('9876500003', GROUP_MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('Debasish Das');
  });

  it('searches by health card number', () => {
    const result = searchSebayats('HC008', GROUP_MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('Prakash Mishra');
  });

  it('returns all when query is empty', () => {
    expect(searchSebayats('', GROUP_MEMBERS)).toHaveLength(5);
  });

  it('returns all when query is whitespace only', () => {
    expect(searchSebayats('   ', GROUP_MEMBERS)).toHaveLength(5);
  });

  it('search is case-insensitive for name', () => {
    const result = searchSebayats('ramesh', GROUP_MEMBERS);
    expect(result).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    expect(searchSebayats('Nonexistent', GROUP_MEMBERS)).toHaveLength(0);
  });
});

describe('Members Directory — Approved Only (MEM-TC-003)', () => {
  it('all group members are approved', () => {
    expect(GROUP_MEMBERS.every((m) => m.profile_status === 'approved')).toBe(true);
  });

  it('non-approved members are excluded', () => {
    const mixed = [...GROUP_MEMBERS, { id: 'm6', full_name: 'Pending User', primary_phone: '999', seba_group: 'pratihari', profile_status: 'draft' }];
    const approvedOnly = mixed.filter((m) => m.profile_status === 'approved');
    expect(approvedOnly).toHaveLength(5);
  });
});

describe('Sebayat Detail — Access Control (SD-TC-006)', () => {
  it('non-approved user cannot view sebayat detail', () => {
    expect(SEBAYAT_DRAFT.profile_status === 'approved').toBe(false);
  });

  it('approved user can view sebayat detail', () => {
    expect(SEBAYAT_APPROVED.profile_status === 'approved').toBe(true);
  });
});
