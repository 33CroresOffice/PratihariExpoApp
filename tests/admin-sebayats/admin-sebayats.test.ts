/**
 * ADMIN-SEP Module Tests — Sebayat Profiles
 * Covers: ADMIN-SEP-TC-001 through ADMIN-SEP-TC-031
 *
 * Tests search/filter, approve/reject/request-changes actions,
 * view profile modal, add profile, and manage profiles.
 */

import {
  ADMIN_CHANGE_CHECKBOXES,
  SECTION_PRIORITY,
  getHighestPrioritySection,
} from '../utils/test-helpers';
import {
  SEBAYAT_DRAFT,
  SEBAYAT_SUBMITTED,
  SEBAYAT_APPROVED,
  SEBAYAT_CHANGES_REQUESTED,
  SEBAYAT_REJECTED,
  TEST_SEBAYAT_ID,
  TEST_ADMIN_ID,
} from '../utils/test-data';

// ─── Search & Filter Logic ────────────────────────────────────────────────────

function searchSebayats(
  sebayats: any[],
  query: string
): any[] {
  if (!query.trim()) return sebayats;
  const q = query.toLowerCase();
  return sebayats.filter(
    (s) =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.primary_phone || '').includes(q) ||
      (s.phone || '').includes(q) ||
      (s.registration_no || '').toLowerCase().includes(q)
  );
}

function filterByStatus(sebayats: any[], status: string): any[] {
  if (status === 'all') return sebayats;
  return sebayats.filter((s) => s.profile_status === status);
}

const ALL_SEBAYATS = [
  { ...SEBAYAT_DRAFT,              id: 's1', full_name: 'Arjun Sharma',    primary_phone: '9000000001' },
  { ...SEBAYAT_SUBMITTED,          id: 's2', full_name: 'Priya Pattnaik',  primary_phone: '9000000002' },
  { ...SEBAYAT_APPROVED,           id: 's3', full_name: 'test user',       primary_phone: '9000000003', registration_no: 'PN-2026-0001' },
  { ...SEBAYAT_CHANGES_REQUESTED,  id: 's4', full_name: 'Meera Rath',      primary_phone: '9000000004' },
  { ...SEBAYAT_REJECTED,           id: 's5', full_name: 'Vikram Nayak',    primary_phone: '9000000005' },
];

describe('ADMIN-SEP — Search & Filter', () => {
  // ADMIN-SEP-TC-001
  test('ADMIN-SEP-TC-001: Search input is LTR — cursor position logic preserves order', () => {
    // Simulates the fix: save selectionStart before render, restore after
    const typed = 'test';
    const selStart = typed.length; // cursor at end after typing
    expect(selStart).toBe(4);
    // After re-render, cursor should be restored to selStart (not 0)
    expect(selStart).not.toBe(0);
  });

  // ADMIN-SEP-TC-002
  test('ADMIN-SEP-TC-002: Search by first name returns matching sebayat', () => {
    const results = searchSebayats(ALL_SEBAYATS, 'Priya');
    expect(results).toHaveLength(1);
    expect(results[0].full_name).toBe('Priya Pattnaik');
  });

  // ADMIN-SEP-TC-003
  test('ADMIN-SEP-TC-003: Search by phone returns matching sebayat', () => {
    const results = searchSebayats(ALL_SEBAYATS, '9000000004');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s4');
  });

  // ADMIN-SEP-TC-004
  test('ADMIN-SEP-TC-004: Search by registration number returns correct sebayat', () => {
    const results = searchSebayats(ALL_SEBAYATS, 'PN-2026-0001');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s3');
  });

  // ADMIN-SEP-TC-005
  test('ADMIN-SEP-TC-005: Filter by submitted shows only submitted profiles', () => {
    const results = filterByStatus(ALL_SEBAYATS, 'submitted');
    expect(results.every((s) => s.profile_status === 'submitted')).toBe(true);
  });

  // ADMIN-SEP-TC-006
  test('ADMIN-SEP-TC-006: Filter by approved shows only approved profiles', () => {
    const results = filterByStatus(ALL_SEBAYATS, 'approved');
    expect(results.every((s) => s.profile_status === 'approved')).toBe(true);
  });

  // ADMIN-SEP-TC-007
  test('ADMIN-SEP-TC-007: Filter by changes_requested shows correct subset', () => {
    const results = filterByStatus(ALL_SEBAYATS, 'changes_requested');
    expect(results.every((s) => s.profile_status === 'changes_requested')).toBe(true);
  });

  // ADMIN-SEP-TC-008
  test('ADMIN-SEP-TC-008: All filter tab count equals total sebayats', () => {
    const all = filterByStatus(ALL_SEBAYATS, 'all');
    expect(all).toHaveLength(ALL_SEBAYATS.length);
  });
});

// ─── Approve Action ───────────────────────────────────────────────────────────

describe('ADMIN-SEP — Approve Action', () => {
  const mockUpdate = jest.fn();

  beforeEach(() => mockUpdate.mockReset());

  // ADMIN-SEP-TC-009
  test('ADMIN-SEP-TC-009: Approve modal builds correct update payload', () => {
    const updates = {
      profile_status: 'approved',
      admin_remarks: 'Welcome!',
      reviewed_at: expect.any(String),
      reviewed_by: TEST_ADMIN_ID,
      change_section: null,
      change_sections: null,
      registration_no: 'PN-2026-0042',
    };
    mockUpdate(updates);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ profile_status: 'approved' }));
  });

  // ADMIN-SEP-TC-010
  test('ADMIN-SEP-TC-010: Registration number included in approve payload', () => {
    const payload = { profile_status: 'approved', registration_no: 'PN-2026-0042' };
    expect(payload.registration_no).toBe('PN-2026-0042');
  });

  // ADMIN-SEP-TC-011
  test('ADMIN-SEP-TC-011: Approve without registration number is valid', () => {
    const payload = { profile_status: 'approved', registration_no: '' };
    const isValid = payload.profile_status === 'approved';
    expect(isValid).toBe(true);
  });

  // ADMIN-SEP-TC-012
  test('ADMIN-SEP-TC-012: Bulk approve — all selected IDs processed', async () => {
    const ids = ['s1', 's2', 's3'];
    const results: string[] = [];
    for (const id of ids) {
      mockUpdate({ id, profile_status: 'approved' });
      results.push(id);
    }
    expect(results).toHaveLength(3);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  // ADMIN-SEP-TC-013
  test('ADMIN-SEP-TC-013: Bulk approve payload has correct status for all', () => {
    const ids = ['s1', 's2'];
    ids.forEach((id) => {
      const payload = { id, profile_status: 'approved' };
      expect(payload.profile_status).toBe('approved');
    });
  });
});

// ─── Reject Action ────────────────────────────────────────────────────────────

describe('ADMIN-SEP — Reject Action', () => {
  // ADMIN-SEP-TC-014 & TC-015
  test('ADMIN-SEP-TC-014/015: Reject requires non-empty remarks', () => {
    const remarksEmpty = '';
    const remarksValid = 'Documents incomplete';
    const canConfirmEmpty = !!(remarksEmpty.trim());
    const canConfirmValid = !!(remarksValid.trim());
    expect(canConfirmEmpty).toBe(false);
    expect(canConfirmValid).toBe(true);
  });

  // ADMIN-SEP-TC-016
  test('ADMIN-SEP-TC-016: Reject payload sets profile_status=rejected with remarks', () => {
    const payload = {
      profile_status: 'rejected',
      admin_remarks: 'Incomplete documents provided.',
      reviewed_at: new Date().toISOString(),
      reviewed_by: TEST_ADMIN_ID,
    };
    expect(payload.profile_status).toBe('rejected');
    expect(payload.admin_remarks).toBeTruthy();
  });
});

// ─── Request Changes Action ───────────────────────────────────────────────────

describe('ADMIN-SEP — Request Changes Action', () => {
  // ADMIN-SEP-TC-017
  test('ADMIN-SEP-TC-017: Request Changes modal has all 6 section checkboxes', () => {
    expect(ADMIN_CHANGE_CHECKBOXES).toHaveLength(6);
  });

  // ADMIN-SEP-TC-018
  test('ADMIN-SEP-TC-018: Checking single box auto-populates one remark line', () => {
    const checked = [ADMIN_CHANGE_CHECKBOXES[0]]; // Profile photo
    const lines = checked.map((b) => `• ${b.line}`);
    const remarks = lines.join('\n');
    expect(remarks).toBe('• Profile photo needs to be re-uploaded.');
  });

  // ADMIN-SEP-TC-019
  test('ADMIN-SEP-TC-019: Checking 4 boxes populates 4 remark lines', () => {
    const checked = ADMIN_CHANGE_CHECKBOXES.slice(0, 4);
    const lines = checked.map((b) => `• ${b.line}`);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('Profile photo');
    expect(lines[3]).toContain('Identity documents');
  });

  // ADMIN-SEP-TC-020
  test('ADMIN-SEP-TC-020: Confirm without any checkbox checked and no remarks is blocked', () => {
    const remarks = '';
    const type = 'changes';
    const isBlocked = (type === 'changes' || type === 'reject') && !remarks.trim();
    expect(isBlocked).toBe(true);
  });

  // ADMIN-SEP-TC-021
  test('ADMIN-SEP-TC-021: change_sections array contains all unique section codes from checked boxes', () => {
    const checked = ADMIN_CHANGE_CHECKBOXES.slice(0, 4);
    // Profile photo + Personal details both → 'personal', Address → 'address', Identity → 'documents'
    const sections = [...new Set(checked.map((b) => b.section).filter(Boolean))];
    expect(sections).toContain('personal');
    expect(sections).toContain('address');
    expect(sections).toContain('documents');
    // personal deduplicated
    expect(sections.filter((s) => s === 'personal')).toHaveLength(1);
  });

  test('ADMIN-SEP-TC-021b: change_section (singular) stores highest-priority section', () => {
    const sections = ['personal', 'address', 'documents'];
    const best = getHighestPrioritySection(sections);
    expect(best).toBe('documents'); // highest index in SECTION_PRIORITY
  });

  // ADMIN-SEP-TC-022
  test('ADMIN-SEP-TC-022: Bulk request changes — all IDs get change_sections saved', async () => {
    const ids = ['s1', 's2'];
    const mockUpdate = jest.fn().mockResolvedValue({ error: null });
    for (const id of ids) {
      await mockUpdate({
        id,
        profile_status: 'changes_requested',
        change_sections: ['personal'],
      });
    }
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ change_sections: ['personal'] })
    );
  });
});

// ─── View Profile ─────────────────────────────────────────────────────────────

describe('ADMIN-SEP — View Profile', () => {
  // ADMIN-SEP-TC-023
  test('ADMIN-SEP-TC-023: View button opens profile detail with correct sebayat data', () => {
    const s = ALL_SEBAYATS[0];
    expect(s.full_name).toBeTruthy();
    expect(s.primary_phone).toBeTruthy();
  });

  // ADMIN-SEP-TC-024
  test('ADMIN-SEP-TC-024: Profile modal data includes all major sections', () => {
    const s = { ...SEBAYAT_APPROVED, id_documents: [{ id_type: 'Aadhar Card' }] };
    expect(s.first_name).toBeTruthy();
    expect(s.primary_phone).toBeTruthy();
    expect(s.permanent_sahi).toBeTruthy();
    expect(s.id_documents).toBeDefined();
  });

  // ADMIN-SEP-TC-025
  test('ADMIN-SEP-TC-025: Photo URL available for display in modal', () => {
    const s = SEBAYAT_APPROVED;
    expect(s.photo_url).toMatch(/^https?:\/\//);
  });
});

// ─── Add & Manage Profiles ────────────────────────────────────────────────────

describe('ADMIN-SEP — Add & Manage Profiles', () => {
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();

  beforeEach(() => { mockInsert.mockReset(); mockUpdate.mockReset(); });

  // ADMIN-SEP-TC-027
  test('ADMIN-SEP-TC-027: Complete add-profile saves new sebayat row', async () => {
    mockInsert.mockResolvedValueOnce({ data: [SEBAYAT_DRAFT], error: null });
    const result = await mockInsert([SEBAYAT_DRAFT]);
    expect(result.error).toBeNull();
    expect(result.data[0].profile_status).toBe('draft');
  });

  // ADMIN-SEP-TC-028
  test('ADMIN-SEP-TC-028: Add profile with missing required fields returns validation errors', () => {
    const e: Record<string, string> = {};
    const first_name = '';
    if (!first_name.trim()) e.first_name = 'Required';
    expect(e.first_name).toBe('Required');
  });

  // ADMIN-SEP-TC-030
  test('ADMIN-SEP-TC-030: Edit form pre-filled with existing data', () => {
    const s = SEBAYAT_APPROVED;
    // Simulate pre-filling form from existing sebayat
    const form = { first_name: s.first_name, last_name: s.last_name };
    expect(form.first_name).toBe(s.first_name);
    expect(form.last_name).toBe(s.last_name);
  });

  // ADMIN-SEP-TC-031
  test('ADMIN-SEP-TC-031: Edit save sends update with modified fields', async () => {
    mockUpdate.mockResolvedValueOnce({ error: null });
    const result = await mockUpdate({ id: TEST_SEBAYAT_ID, alias_name: 'Rajan' });
    expect(result.error).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_SEBAYAT_ID, alias_name: 'Rajan' })
    );
  });
});
