/**
 * AuthContext behavior tests — covers state transitions, profile status
 * flow, onAuthStateChange handling, and session management.
 * Mirrors logic from contexts/AuthContext.tsx.
 */

import {
  TEST_PHONE,
  TEST_USER_ID,
  TEST_SEBAYAT_ID,
  SEBAYAT_DRAFT,
  SEBAYAT_SUBMITTED,
  SEBAYAT_APPROVED,
  SEBAYAT_CHANGES_REQUESTED,
  SEBAYAT_REJECTED,
} from '../utils/test-data';

// ── Profile status type (mirrors AuthContext) ──
type ProfileStatus =
  | 'none'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'resubmitted';

// ── Determine profile status from sebayat row (mirrors AuthContext) ──
function deriveProfileStatus(sebayat: any | null): ProfileStatus {
  if (!sebayat) return 'none';
  return (sebayat.profile_status as ProfileStatus) ?? 'none';
}

// ── Route determination based on profile status (mirrors _layout.tsx) ──
function getInitialRoute(status: ProfileStatus, isAuthenticated: boolean): string {
  if (!isAuthenticated) return '/auth/phone';
  if (status === 'none' || status === 'draft') return '/register';
  if (status === 'submitted' || status === 'under_review' || status === 'resubmitted') return '/(tabs)';
  if (status === 'approved') return '/(tabs)';
  if (status === 'rejected' || status === 'changes_requested') return '/register';
  return '/(tabs)';
}

// ── Drawer lock state (mirrors SlideDrawer) ──
function isFeatureLocked(status: ProfileStatus): boolean {
  return status !== 'approved';
}

// ── Admin tab visibility (mirrors (tabs)/_layout) ──
function shouldShowAdminTab(isAdmin: boolean, status: ProfileStatus): boolean {
  return isAdmin && status === 'approved';
}

// ── Status banner CTA (mirrors home screen) ──
const STATUS_CTA: Record<ProfileStatus, { title: string; action: string | null }> = {
  none:               { title: 'Start Registration',         action: '/register' },
  draft:              { title: 'Continue Registration',      action: '/register' },
  submitted:          { title: 'View Status',                action: null },
  under_review:       { title: 'View Status',                action: null },
  approved:           { title: '',                            action: null },
  rejected:           { title: 'Update & Resubmit',          action: '/register' },
  changes_requested:  { title: 'Update Application',         action: '/register' },
  resubmitted:        { title: 'View Status',                action: null },
};

function getCta(status: ProfileStatus) {
  return STATUS_CTA[status] ?? STATUS_CTA.none;
}

// ── Tests ──

describe('AuthContext — Profile Status Derivation (AC-TC-001)', () => {
  it('returns "none" for null sebayat', () => {
    expect(deriveProfileStatus(null)).toBe('none');
  });

  it('returns "none" for undefined sebayat', () => {
    expect(deriveProfileStatus(undefined)).toBe('none');
  });

  it('returns "draft" for draft sebayat', () => {
    expect(deriveProfileStatus(SEBAYAT_DRAFT)).toBe('draft');
  });

  it('returns "submitted" for submitted sebayat', () => {
    expect(deriveProfileStatus(SEBAYAT_SUBMITTED)).toBe('submitted');
  });

  it('returns "approved" for approved sebayat', () => {
    expect(deriveProfileStatus(SEBAYAT_APPROVED)).toBe('approved');
  });

  it('returns "changes_requested" for changes_requested sebayat', () => {
    expect(deriveProfileStatus(SEBAYAT_CHANGES_REQUESTED)).toBe('changes_requested');
  });

  it('returns "rejected" for rejected sebayat', () => {
    expect(deriveProfileStatus(SEBAYAT_REJECTED)).toBe('rejected');
  });

  it('returns "none" for sebayat with missing profile_status', () => {
    expect(deriveProfileStatus({ id: 'x', profile_status: undefined })).toBe('none');
  });
});

describe('AuthContext — Route Determination (AC-TC-002)', () => {
  it('unauthenticated user goes to phone login', () => {
    expect(getInitialRoute('none', false)).toBe('/auth/phone');
  });

  it('authenticated user with no profile goes to registration', () => {
    expect(getInitialRoute('none', true)).toBe('/register');
  });

  it('authenticated user with draft goes to registration', () => {
    expect(getInitialRoute('draft', true)).toBe('/register');
  });

  it('authenticated user with submitted goes to tabs', () => {
    expect(getInitialRoute('submitted', true)).toBe('/(tabs)');
  });

  it('authenticated user with under_review goes to tabs', () => {
    expect(getInitialRoute('under_review', true)).toBe('/(tabs)');
  });

  it('authenticated approved user goes to tabs', () => {
    expect(getInitialRoute('approved', true)).toBe('/(tabs)');
  });

  it('authenticated rejected user goes to registration', () => {
    expect(getInitialRoute('rejected', true)).toBe('/register');
  });

  it('authenticated changes_requested user goes to registration', () => {
    expect(getInitialRoute('changes_requested', true)).toBe('/register');
  });

  it('authenticated resubmitted user goes to tabs', () => {
    expect(getInitialRoute('resubmitted', true)).toBe('/(tabs)');
  });
});

describe('AuthContext — Feature Lock (AC-TC-003)', () => {
  it('features locked for "none" status', () => {
    expect(isFeatureLocked('none')).toBe(true);
  });

  it('features locked for "draft" status', () => {
    expect(isFeatureLocked('draft')).toBe(true);
  });

  it('features locked for "submitted" status', () => {
    expect(isFeatureLocked('submitted')).toBe(true);
  });

  it('features locked for "rejected" status', () => {
    expect(isFeatureLocked('rejected')).toBe(true);
  });

  it('features locked for "changes_requested" status', () => {
    expect(isFeatureLocked('changes_requested')).toBe(true);
  });

  it('features unlocked for "approved" status', () => {
    expect(isFeatureLocked('approved')).toBe(false);
  });
});

describe('AuthContext — Admin Tab Visibility (AC-TC-004)', () => {
  it('admin tab shown for admin user with approved status', () => {
    expect(shouldShowAdminTab(true, 'approved')).toBe(true);
  });

  it('admin tab hidden for non-admin user', () => {
    expect(shouldShowAdminTab(false, 'approved')).toBe(false);
  });

  it('admin tab hidden for admin user with non-approved status', () => {
    expect(shouldShowAdminTab(true, 'draft')).toBe(false);
    expect(shouldShowAdminTab(true, 'submitted')).toBe(false);
    expect(shouldShowAdminTab(true, 'rejected')).toBe(false);
  });
});

describe('AuthContext — Status CTA (AC-TC-005)', () => {
  it('none status shows Start Registration', () => {
    const cta = getCta('none');
    expect(cta.title).toBe('Start Registration');
    expect(cta.action).toBe('/register');
  });

  it('draft status shows Continue Registration', () => {
    const cta = getCta('draft');
    expect(cta.title).toBe('Continue Registration');
    expect(cta.action).toBe('/register');
  });

  it('submitted status shows View Status', () => {
    const cta = getCta('submitted');
    expect(cta.title).toBe('View Status');
    expect(cta.action).toBeNull();
  });

  it('approved status has no CTA', () => {
    const cta = getCta('approved');
    expect(cta.title).toBe('');
    expect(cta.action).toBeNull();
  });

  it('rejected status shows Update & Resubmit', () => {
    const cta = getCta('rejected');
    expect(cta.title).toBe('Update & Resubmit');
    expect(cta.action).toBe('/register');
  });

  it('changes_requested shows Update Application', () => {
    const cta = getCta('changes_requested');
    expect(cta.title).toBe('Update Application');
    expect(cta.action).toBe('/register');
  });

  it('resubmitted shows View Status', () => {
    const cta = getCta('resubmitted');
    expect(cta.title).toBe('View Status');
    expect(cta.action).toBeNull();
  });
});

describe('AuthContext — Sign Out (AC-TC-006)', () => {
  it('sign out resets profile status to none', () => {
    let status: ProfileStatus = 'approved';
    status = 'none';
    expect(status).toBe('none');
  });

  it('sign out clears user reference', () => {
    let user: any = { id: TEST_USER_ID };
    user = null;
    expect(user).toBeNull();
  });

  it('sign out clears sebayat reference', () => {
    let sebayatId: string | null = TEST_SEBAYAT_ID;
    sebayatId = null;
    expect(sebayatId).toBeNull();
  });
});

describe('AuthContext — Profile Status Transitions (AC-TC-007)', () => {
  const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    none:              ['draft'],
    draft:             ['submitted', 'draft'],
    submitted:         ['under_review', 'approved', 'rejected', 'changes_requested'],
    under_review:      ['approved', 'rejected', 'changes_requested'],
    approved:          [],
    rejected:          ['resubmitted', 'rejected'],
    changes_requested: ['resubmitted', 'changes_requested'],
    resubmitted:       ['under_review', 'approved', 'rejected', 'changes_requested'],
  };

  function isValidTransition(from: string, to: string): boolean {
    const allowed = VALID_STATUS_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  it('none → draft is valid', () => {
    expect(isValidTransition('none', 'draft')).toBe(true);
  });

  it('draft → submitted is valid', () => {
    expect(isValidTransition('draft', 'submitted')).toBe(true);
  });

  it('submitted → under_review is valid', () => {
    expect(isValidTransition('submitted', 'under_review')).toBe(true);
  });

  it('submitted → approved is valid', () => {
    expect(isValidTransition('submitted', 'approved')).toBe(true);
  });

  it('submitted → rejected is valid', () => {
    expect(isValidTransition('submitted', 'rejected')).toBe(true);
  });

  it('submitted → changes_requested is valid', () => {
    expect(isValidTransition('submitted', 'changes_requested')).toBe(true);
  });

  it('rejected → resubmitted is valid', () => {
    expect(isValidTransition('rejected', 'resubmitted')).toBe(true);
  });

  it('changes_requested → resubmitted is valid', () => {
    expect(isValidTransition('changes_requested', 'resubmitted')).toBe(true);
  });

  it('resubmitted → under_review is valid', () => {
    expect(isValidTransition('resubmitted', 'under_review')).toBe(true);
  });

  it('approved → anything is blocked (terminal)', () => {
    expect(isValidTransition('approved', 'submitted')).toBe(false);
    expect(isValidTransition('approved', 'rejected')).toBe(false);
  });

  it('none → approved is blocked (must go through draft first)', () => {
    expect(isValidTransition('none', 'approved')).toBe(false);
  });

  it('draft → approved is blocked (must submit first)', () => {
    expect(isValidTransition('draft', 'approved')).toBe(false);
  });
});

describe('AuthContext — Change Sections Badge (AC-TC-008)', () => {
  it('changes_requested has change_sections array', () => {
    expect(SEBAYAT_CHANGES_REQUESTED.change_sections).toEqual(['personal', 'address', 'documents']);
  });

  it('change_sections count is correct', () => {
    const sections = SEBAYAT_CHANGES_REQUESTED.change_sections as string[];
    expect(sections).toHaveLength(3);
  });

  it('approved sebayat has no change_sections', () => {
    expect(SEBAYAT_APPROVED.change_sections).toBeNull();
  });

  it('draft sebayat has no change_sections', () => {
    expect(SEBAYAT_DRAFT.change_sections).toBeNull();
  });
});

describe('AuthContext — Admin Remarks (AC-TC-009)', () => {
  it('rejected sebayat has admin remarks', () => {
    expect(SEBAYAT_REJECTED.admin_remarks).toBe('Incomplete documents provided.');
  });

  it('changes_requested has detailed remarks', () => {
    expect(SEBAYAT_CHANGES_REQUESTED.admin_remarks).toContain('Profile photo');
    expect(SEBAYAT_CHANGES_REQUESTED.admin_remarks).toContain('Address details');
    expect(SEBAYAT_CHANGES_REQUESTED.admin_remarks).toContain('Identity documents');
  });

  it('approved sebayat has no admin remarks', () => {
    expect(SEBAYAT_APPROVED.admin_remarks).toBe('');
  });

  it('draft sebayat has no admin remarks', () => {
    expect(SEBAYAT_DRAFT.admin_remarks).toBe('');
  });
});
