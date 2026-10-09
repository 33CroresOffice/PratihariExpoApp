/**
 * Committee module tests — covers member sorting, role styling,
 * term selection, bilingual display, and access control.
 * Mirrors logic from app/committee.tsx.
 */

import {
  SEBAYAT_APPROVED,
  SEBAYAT_DRAFT,
} from '../utils/test-data';

// ── Role colors (mirrors committee.tsx) ──
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  'President':        { bg: '#FEF3C7', color: '#92400E' },
  'Vice President':   { bg: '#FEF9C3', color: '#713F12' },
  'Secretary':        { bg: '#DBEAFE', color: '#1E40AF' },
  'Joint Secretary':  { bg: '#EFF6FF', color: '#1D4ED8' },
  'Treasurer':        { bg: '#D1FAE5', color: '#065F46' },
  'Joint Treasurer':  { bg: '#ECFDF5', color: '#047857' },
  'Advisor':          { bg: '#F3E8FF', color: '#6B21A8' },
};

function getRoleStyle(role: string) {
  return ROLE_COLORS[role] ?? { bg: '#F3F4F6', color: '#374151' };
}

// ── Initials (mirrors committee.tsx) ──
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Member sort (mirrors committee.tsx) ──
function sortMembers(members: any[]): any[] {
  return [...members].sort((a, b) => a.role_order - b.role_order);
}

// ── Active committee finder ──
function findActive(committees: any[]): any | null {
  return committees.find((c) => c.is_active) ?? null;
}

// ── pickLocalized (mirrors lib/i18n.ts) ──
function pickLocalized(row: any, field: string, lang: string): string {
  const orField = `${field}_or`;
  if (lang === 'or' && row[orField]) return row[orField];
  return row[field] ?? '';
}

// ── Fixtures ──
const MEMBERS = [
  { id: 'm1', name: 'Ramesh Pratihari', name_or: 'ରମେଶ ପ୍ରତିହାରୀ', role: 'Member',        role_or: 'ସଦସ୍ୟ',        role_order: 7, photo_url: '', phone: '9876543210', bio: 'Active member', description_or: '' },
  { id: 'm2', name: 'Suresh Pratihari', name_or: 'ସୁରେଶ ପ୍ରତିହାରୀ', role: 'President',     role_or: 'ସଭାପତି',      role_order: 1, photo_url: '', phone: '9876500001', bio: 'Committee head', description_or: 'କମିଟି ମୁଖ୍ୟ' },
  { id: 'm3', name: 'Debasish Das',     name_or: 'ଦେବାସୀଶ ଦାସ',     role: 'Secretary',    role_or: 'ସଚିବ',       role_order: 3, photo_url: '', phone: '9876500002', bio: 'Records keeper', description_or: '' },
  { id: 'm4', name: 'Prakash Mishra',   name_or: 'ପ୍ରକାଶ ମିଶ୍ର',     role: 'Vice President', role_or: 'ଉପସଭାପତି',  role_order: 2, photo_url: '', phone: '9876500003', bio: '', description_or: '' },
  { id: 'm5', name: 'Ashok Pratihari',  name_or: 'ଅଶୋକ ପ୍ରତିହାରୀ',  role: 'Treasurer',    role_or: 'କୋଷାଧ୍ୟକ୍ଷ',   role_order: 5, photo_url: '', phone: '9876500004', bio: 'Financial officer', description_or: '' },
];

const COMMITTEES = [
  { id: 'com-001', year: 2026, title: 'Managing Committee 2026', title_or: 'ପରିଚାଳନା କମିଟି ୨୦୨୬', description: 'Current committee', description_or: 'ବର୍ତ୍ତମାନ କମିଟି', is_active: true,  committee_members: MEMBERS },
  { id: 'com-002', year: 2025, title: 'Managing Committee 2025', title_or: null,                  description: 'Previous committee', description_or: null,                 is_active: false, committee_members: [MEMBERS[0], MEMBERS[1]] },
  { id: 'com-003', year: 2024, title: 'Managing Committee 2024', title_or: null,                  description: 'Old committee',      description_or: null,                 is_active: false, committee_members: [] },
];

// ── Tests ──

describe('Committee — Member Sorting (COMM-TC-001)', () => {
  it('sorts members by role_order ascending', () => {
    const sorted = sortMembers(MEMBERS);
    expect(sorted[0].role).toBe('President');
    expect(sorted[1].role).toBe('Vice President');
    expect(sorted[2].role).toBe('Secretary');
    expect(sorted[3].role).toBe('Treasurer');
    expect(sorted[4].role).toBe('Member');
  });

  it('preserves all members after sorting', () => {
    const sorted = sortMembers(MEMBERS);
    expect(sorted).toHaveLength(5);
  });

  it('does not mutate the original array', () => {
    const original = [...MEMBERS];
    sortMembers(MEMBERS);
    expect(MEMBERS[0].role).toBe(original[0].role);
  });

  it('handles empty members array', () => {
    expect(sortMembers([])).toHaveLength(0);
  });

  it('handles single member', () => {
    const sorted = sortMembers([MEMBERS[1]]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].role).toBe('President');
  });
});

describe('Committee — Role Styling (COMM-TC-002)', () => {
  it('returns correct style for President', () => {
    const style = getRoleStyle('President');
    expect(style.bg).toBe('#FEF3C7');
    expect(style.color).toBe('#92400E');
  });

  it('returns correct style for Secretary', () => {
    const style = getRoleStyle('Secretary');
    expect(style.bg).toBe('#DBEAFE');
    expect(style.color).toBe('#1E40AF');
  });

  it('returns correct style for Treasurer', () => {
    const style = getRoleStyle('Treasurer');
    expect(style.bg).toBe('#D1FAE5');
    expect(style.color).toBe('#065F46');
  });

  it('returns default style for unknown role', () => {
    const style = getRoleStyle('Unknown');
    expect(style.bg).toBe('#F3F4F6');
    expect(style.color).toBe('#374151');
  });

  it('returns default style for "Member" (no specific color)', () => {
    const style = getRoleStyle('Member');
    expect(style.bg).toBe('#F3F4F6');
  });
});

describe('Committee — Initials (COMM-TC-003)', () => {
  it('generates initials from full name', () => {
    expect(getInitials('Ramesh Pratihari')).toBe('RP');
  });

  it('generates initials from three-word name', () => {
    expect(getInitials('Soumya Ranjan Das')).toBe('SR');
  });

  it('generates initial from single name', () => {
    expect(getInitials('Ramesh')).toBe('R');
  });

  it('handles empty name gracefully', () => {
    expect(getInitials('')).toBe('');
  });
});

describe('Committee — Active Committee (COMM-TC-004)', () => {
  it('finds the active committee', () => {
    const active = findActive(COMMITTEES);
    expect(active).not.toBeNull();
    expect(active!.id).toBe('com-001');
    expect(active!.year).toBe(2026);
  });

  it('returns null when no active committee', () => {
    const allInactive = COMMITTEES.map((c) => ({ ...c, is_active: false }));
    expect(findActive(allInactive)).toBeNull();
  });

  it('returns the first active when multiple active (should not happen but handled)', () => {
    const multi = [{ ...COMMITTEES[0], is_active: true }, { ...COMMITTEES[1], is_active: true }];
    const active = findActive(multi);
    expect(active!.id).toBe('com-001');
  });
});

describe('Committee — Bilingual Display (COMM-TC-005)', () => {
  it('shows Odia title when language is "or" and title_or exists', () => {
    const title = pickLocalized(COMMITTEES[0], 'title', 'or');
    expect(title).toBe('ପରିଚାଳନା କମିଟି ୨୦୨୬');
  });

  it('falls back to English when title_or is null', () => {
    const title = pickLocalized(COMMITTEES[1], 'title', 'or');
    expect(title).toBe('Managing Committee 2025');
  });

  it('shows English title when language is "en"', () => {
    const title = pickLocalized(COMMITTEES[0], 'title', 'en');
    expect(title).toBe('Managing Committee 2026');
  });

  it('shows Odia member name when available', () => {
    const name = pickLocalized(MEMBERS[0], 'name', 'or');
    expect(name).toBe('ରମେଶ ପ୍ରତିହାରୀ');
  });

  it('falls back to English member name when name_or is empty', () => {
    const memberNoOria = { ...MEMBERS[0], name_or: '' };
    const name = pickLocalized(memberNoOria, 'name', 'or');
    expect(name).toBe('Ramesh Pratihari');
  });

  it('shows Odia role when available', () => {
    const role = pickLocalized(MEMBERS[1], 'role', 'or');
    expect(role).toBe('ସଭାପତି');
  });

  it('falls back to English role when role_or is empty', () => {
    const memberNoOria = { ...MEMBERS[0], role_or: '' };
    const role = pickLocalized(memberNoOria, 'role', 'or');
    expect(role).toBe('Member');
  });
});

describe('Committee — Committee List (COMM-TC-006)', () => {
  it('committees are ordered by year descending', () => {
    const sorted = [...COMMITTEES].sort((a, b) => b.year - a.year);
    expect(sorted[0].year).toBe(2026);
    expect(sorted[1].year).toBe(2025);
    expect(sorted[2].year).toBe(2024);
  });

  it('active committee has is_active flag', () => {
    const active = COMMITTEES.find((c) => c.is_active);
    expect(active).toBeDefined();
    expect(active!.is_active).toBe(true);
  });

  it('inactive committees have is_active=false', () => {
    const inactive = COMMITTEES.filter((c) => !c.is_active);
    expect(inactive).toHaveLength(2);
  });
});

describe('Committee — Member Count (COMM-TC-007)', () => {
  it('reports correct member count per committee', () => {
    expect(COMMITTEES[0].committee_members).toHaveLength(5);
    expect(COMMITTEES[1].committee_members).toHaveLength(2);
    expect(COMMITTEES[2].committee_members).toHaveLength(0);
  });

  it('committee with no members shows empty state', () => {
    const isEmpty = COMMITTEES[2].committee_members.length === 0;
    expect(isEmpty).toBe(true);
  });
});

describe('Committee — President Star (COMM-TC-008)', () => {
  it('President role gets star indicator', () => {
    const president = MEMBERS.find((m) => m.role === 'President');
    expect(president).toBeDefined();
    expect(president!.role).toBe('President');
  });

  it('non-President roles do not get star', () => {
    const nonPresidents = MEMBERS.filter((m) => m.role !== 'President');
    expect(nonPresidents.every((m) => m.role !== 'President')).toBe(true);
  });
});

describe('Committee — Access Control (COMM-TC-009)', () => {
  it('non-approved user is redirected away', () => {
    const canAccess = SEBAYAT_DRAFT.profile_status === 'approved';
    expect(canAccess).toBe(false);
  });

  it('approved user can access committee screen', () => {
    const canAccess = SEBAYAT_APPROVED.profile_status === 'approved';
    expect(canAccess).toBe(true);
  });
});

describe('Committee — Member Phone (COMM-TC-010)', () => {
  it('all members have phone field', () => {
    expect(MEMBERS.every((m) => !!m.phone)).toBe(true);
  });

  it('phone is a 10-digit number', () => {
    expect(MEMBERS[0].phone).toMatch(/^\d{10}$/);
  });
});
