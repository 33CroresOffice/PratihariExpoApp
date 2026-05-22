/**
 * DB Module Tests — Schema, RLS, Data Integrity
 * Covers: DB-TC-001 through DB-TC-007
 */

import {
  SEBAYAT_DRAFT,
  SEBAYAT_APPROVED,
  SEBAYAT_CHANGES_REQUESTED,
  TEST_SEBAYAT_ID,
  TEST_USER_ID,
} from '../utils/test-data';

// ─── Schema shape validators (mirror actual DB columns) ───────────────────────

interface SebayatRow {
  id: string;
  auth_user_id?: string | null;
  profile_status: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  primary_phone?: string;
  registration_no?: string | null;
  admin_remarks?: string;
  change_section?: string | null;
  change_sections?: string[] | null;
  created_at?: string;
}

interface OtpSessionRow {
  id?: string;
  phone: string;
  request_id: string;
  channel: string;
  verified: boolean;
  expires_at: string;
}

interface AppSettingRow {
  key: string;
  value: any;
  type: string;
}

// ─── Upsert / merge logic ─────────────────────────────────────────────────────

function upsertSebayat(
  existing: SebayatRow | null,
  updates: Partial<SebayatRow>
): SebayatRow {
  if (!existing) return { id: TEST_SEBAYAT_ID, profile_status: 'draft', ...updates };
  return { ...existing, ...updates };
}

// ─── RLS policy simulation helpers ───────────────────────────────────────────

function canSelectSebayat(row: SebayatRow, callerUserId: string | null): boolean {
  if (!callerUserId) return false;
  return row.auth_user_id === callerUserId;
}

function canUpdateSebayat(row: SebayatRow, callerUserId: string | null): boolean {
  if (!callerUserId) return false;
  return row.auth_user_id === callerUserId;
}

function isAdminRole(callerRole: 'admin' | 'anon' | 'authenticated'): boolean {
  return callerRole === 'admin';
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('DB Module — Schema Integrity', () => {
  // DB-TC-001
  test('DB-TC-001: sebayats row has required fields', () => {
    const row: SebayatRow = SEBAYAT_DRAFT as SebayatRow;
    expect(row.id).toBeTruthy();
    expect(row.profile_status).toBeTruthy();
    expect(['draft', 'submitted', 'approved', 'rejected', 'changes_requested', 'resubmitted']).toContain(row.profile_status);
  });

  // DB-TC-002
  test('DB-TC-002: change_sections column is text array or null', () => {
    const approved: SebayatRow = SEBAYAT_APPROVED as SebayatRow;
    expect(approved.change_sections === null || Array.isArray(approved.change_sections)).toBe(true);

    const cr: SebayatRow = SEBAYAT_CHANGES_REQUESTED as SebayatRow;
    expect(Array.isArray(cr.change_sections)).toBe(true);
    expect(cr.change_sections!.length).toBeGreaterThan(0);
  });

  // DB-TC-003
  test('DB-TC-003: change_sections cleared on approval', () => {
    const afterApproval = upsertSebayat(SEBAYAT_CHANGES_REQUESTED as SebayatRow, {
      profile_status: 'approved',
      change_section: null,
      change_sections: null,
      admin_remarks: '',
    });
    expect(afterApproval.change_sections).toBeNull();
    expect(afterApproval.change_section).toBeNull();
    expect(afterApproval.admin_remarks).toBe('');
    expect(afterApproval.profile_status).toBe('approved');
  });

  // DB-TC-004
  test('DB-TC-004: otp_sessions row has required fields and correct schema', () => {
    const session: OtpSessionRow = {
      phone: '9876543210',
      request_id: 'req-abc123',
      channel: 'sms',
      verified: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    expect(session.phone).toBeTruthy();
    expect(session.request_id).toBeTruthy();
    expect(['sms', 'whatsapp']).toContain(session.channel);
    expect(session.verified).toBe(false);
    expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  // DB-TC-005
  test('DB-TC-005: app_settings row has key, value, type fields', () => {
    const settings: AppSettingRow[] = [
      { key: 'otp_sms_enabled',       value: true,         type: 'boolean' },
      { key: 'otp_whatsapp_enabled',   value: false,        type: 'boolean' },
      { key: 'push_reminder_days',     value: '3',          type: 'string'  },
    ];
    settings.forEach((s) => {
      expect(s.key).toBeTruthy();
      expect(s.type).toBeTruthy();
      expect(['boolean', 'string', 'number', 'json']).toContain(s.type);
    });
  });
});

describe('DB Module — RLS Simulation', () => {
  // DB-TC-006
  test('DB-TC-006: RLS — user can read their own sebayat row', () => {
    const row: SebayatRow = { ...SEBAYAT_DRAFT, auth_user_id: TEST_USER_ID } as SebayatRow;
    expect(canSelectSebayat(row, TEST_USER_ID)).toBe(true);
  });

  test('DB-TC-006b: RLS — unauthenticated user cannot read sebayat row', () => {
    const row: SebayatRow = { ...SEBAYAT_DRAFT, auth_user_id: TEST_USER_ID } as SebayatRow;
    expect(canSelectSebayat(row, null)).toBe(false);
  });

  test('DB-TC-006c: RLS — user cannot read another user\'s sebayat row', () => {
    const row: SebayatRow = { ...SEBAYAT_DRAFT, auth_user_id: 'other-user-id' } as SebayatRow;
    expect(canSelectSebayat(row, TEST_USER_ID)).toBe(false);
  });

  // DB-TC-007
  test('DB-TC-007: RLS — user can update their own sebayat row', () => {
    const row: SebayatRow = { ...SEBAYAT_DRAFT, auth_user_id: TEST_USER_ID } as SebayatRow;
    expect(canUpdateSebayat(row, TEST_USER_ID)).toBe(true);
  });

  test('DB-TC-007b: RLS — user cannot update another user\'s row', () => {
    const row: SebayatRow = { ...SEBAYAT_DRAFT, auth_user_id: 'other-user-id' } as SebayatRow;
    expect(canUpdateSebayat(row, TEST_USER_ID)).toBe(false);
  });

  test('DB-TC-007c: Admin role bypasses user-level RLS check', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('authenticated')).toBe(false);
    expect(isAdminRole('anon')).toBe(false);
  });
});

describe('DB Module — Upsert Correctness', () => {
  test('Upsert merges fields without overwriting unrelated ones', () => {
    const existing: SebayatRow = {
      id: TEST_SEBAYAT_ID,
      profile_status: 'draft',
      first_name: 'Soumya',
      last_name: 'Pratihari',
    };
    const result = upsertSebayat(existing, { first_name: 'Suman' });
    expect(result.first_name).toBe('Suman');
    expect(result.last_name).toBe('Pratihari');
    expect(result.profile_status).toBe('draft');
  });

  test('Upsert on null existing creates new row', () => {
    const result = upsertSebayat(null, { profile_status: 'draft', first_name: 'New' });
    expect(result.id).toBeTruthy();
    expect(result.first_name).toBe('New');
    expect(result.profile_status).toBe('draft');
  });

  test('change_sections upsert with multiple sections', () => {
    const updated = upsertSebayat(SEBAYAT_DRAFT as SebayatRow, {
      profile_status: 'changes_requested',
      change_section: 'personal',
      change_sections: ['personal', 'address', 'documents'],
      admin_remarks: 'Please update personal and address details.',
    });
    expect(updated.change_sections).toEqual(['personal', 'address', 'documents']);
    expect(updated.change_section).toBe('personal');
    expect(updated.admin_remarks).toBeTruthy();
  });
});

describe('DB Module — Status Transition Validation', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft:              ['submitted'],
    submitted:          ['approved', 'rejected', 'changes_requested'],
    changes_requested:  ['resubmitted'],
    resubmitted:        ['approved', 'rejected', 'changes_requested'],
    rejected:           [],
    approved:           [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return (VALID_TRANSITIONS[from] ?? []).includes(to);
  }

  test('draft → submitted is valid', () => expect(isValidTransition('draft', 'submitted')).toBe(true));
  test('submitted → approved is valid', () => expect(isValidTransition('submitted', 'approved')).toBe(true));
  test('submitted → changes_requested is valid', () => expect(isValidTransition('submitted', 'changes_requested')).toBe(true));
  test('changes_requested → resubmitted is valid', () => expect(isValidTransition('changes_requested', 'resubmitted')).toBe(true));
  test('approved → submitted is invalid', () => expect(isValidTransition('approved', 'submitted')).toBe(false));
  test('rejected → approved is invalid', () => expect(isValidTransition('rejected', 'approved')).toBe(false));
  test('draft → approved is invalid', () => expect(isValidTransition('draft', 'approved')).toBe(false));
});
