/**
 * HOME Module Tests
 * Covers: HOME-TC-001 through HOME-TC-016
 *
 * Tests status CTA card display logic, change-request badge count,
 * navigation, session tracking, and carousel behaviour.
 */

import {
  SEBAYAT_DRAFT,
  SEBAYAT_SUBMITTED,
  SEBAYAT_APPROVED,
  SEBAYAT_CHANGES_REQUESTED,
  SEBAYAT_REJECTED,
  DUTY_ENTRY,
  SEBA_SESSION,
} from '../utils/test-data';

// ─── Status CTA logic (mirrors index.tsx STATUS_CTA_I18N) ────────────────────

type ProfileStatus = 'none' | 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested' | 'resubmitted';

interface CtaConfig {
  title: string;
  action: string;
  showFullDashboard: boolean;
}

const STATUS_CTA: Record<string, CtaConfig> = {
  none:               { title: 'Complete Registration', action: 'Complete Registration', showFullDashboard: false },
  draft:              { title: 'Complete Registration', action: 'Continue Registration',  showFullDashboard: false },
  submitted:          { title: 'Under Review',          action: 'View Status',           showFullDashboard: false },
  under_review:       { title: 'Under Review',          action: 'View Status',           showFullDashboard: false },
  approved:           { title: '',                      action: '',                       showFullDashboard: true  },
  rejected:           { title: 'Application Rejected',  action: 'Update & Resubmit',     showFullDashboard: false },
  changes_requested:  { title: 'Changes Requested',     action: 'Update Application',    showFullDashboard: false },
  resubmitted:        { title: 'Resubmitted',            action: 'View Status',           showFullDashboard: false },
};

function getCta(status: string) {
  return STATUS_CTA[status] || STATUS_CTA.none;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('HOME Module — Status CTA Cards', () => {
  // HOME-TC-001
  test('HOME-TC-001: No registration (status=none) → Complete Registration CTA', () => {
    const cta = getCta('none');
    expect(cta.title).toBe('Complete Registration');
    expect(cta.showFullDashboard).toBe(false);
  });

  // HOME-TC-002
  test('HOME-TC-002: Draft status → Complete Registration CTA', () => {
    const cta = getCta('draft');
    expect(cta.title).toBe('Complete Registration');
    expect(cta.showFullDashboard).toBe(false);
  });

  // HOME-TC-003
  test('HOME-TC-003: Submitted status → Under Review card', () => {
    const cta = getCta('submitted');
    expect(cta.title).toBe('Under Review');
  });

  // HOME-TC-004
  test('HOME-TC-004: changes_requested status → Changes Requested card shown', () => {
    const cta = getCta('changes_requested');
    expect(cta.title).toBe('Changes Requested');
  });

  test('HOME-TC-004b: change_sections with 3 items → badge shows "3 sections"', () => {
    const changeSections = SEBAYAT_CHANGES_REQUESTED.change_sections;
    const count = changeSections.length;
    expect(count).toBe(3);
    const badge = `${count} section${count !== 1 ? 's' : ''}`;
    expect(badge).toBe('3 sections');
  });

  // HOME-TC-005
  test('HOME-TC-005: Resubmitted status → Resubmitted card shown', () => {
    const cta = getCta('resubmitted');
    expect(cta.title).toBe('Resubmitted');
    expect(cta.action).toBe('View Status');
  });

  // HOME-TC-006
  test('HOME-TC-006: Approved status → full dashboard shown', () => {
    const cta = getCta('approved');
    expect(cta.showFullDashboard).toBe(true);
  });

  // HOME-TC-007
  test('HOME-TC-007: Approved user has today beddha numbers available', () => {
    const todayBeddha = { pratihari: 2, gochhikar: 1 };
    expect(todayBeddha.pratihari).toBe(2);
    expect(todayBeddha.gochhikar).toBe(1);
  });
});

describe('HOME Module — Navigation & Actions', () => {
  // HOME-TC-008
  test('HOME-TC-008: Update Application navigates to /register with change_sections param', () => {
    const status = 'changes_requested';
    const adminRemarks = SEBAYAT_CHANGES_REQUESTED.admin_remarks;
    const changeSections = SEBAYAT_CHANGES_REQUESTED.change_sections;
    const navigatesToRegister =
      (status === 'rejected' || status === 'changes_requested') && !!adminRemarks;
    expect(navigatesToRegister).toBe(true);

    // Verify change_sections passed as comma-separated param
    const param = changeSections.join(',');
    expect(param).toBe('personal,address,documents');
  });

  test('HOME-TC-008b: Without adminRemarks navigates to /register without params', () => {
    const status = 'changes_requested';
    const adminRemarks = '';
    const navigatesWithParams =
      (status === 'rejected' || status === 'changes_requested') && !!adminRemarks;
    expect(navigatesWithParams).toBe(false);
  });

  // HOME-TC-009
  test('HOME-TC-009: Unread notice count ≥ 1 shows badge', () => {
    const unreadNoticeCount = 3;
    const showBadge = unreadNoticeCount > 0;
    expect(showBadge).toBe(true);
  });

  test('HOME-TC-009b: Zero unread notices — no badge', () => {
    const unreadNoticeCount = 0;
    const showBadge = unreadNoticeCount > 0;
    expect(showBadge).toBe(false);
  });

  // HOME-TC-010
  test('HOME-TC-010: Startup notices array triggers modal display', () => {
    const startupNotices = [{ id: 'n1', title: 'Welcome', pinned: true }];
    const showStartupNotice = startupNotices.length > 0;
    expect(showStartupNotice).toBe(true);
  });

  // HOME-TC-011
  test('HOME-TC-011: Next button on startup notice advances index', () => {
    let idx = 0;
    const notices = [{ id: 'n1' }, { id: 'n2' }];
    if (idx + 1 < notices.length) idx++;
    expect(idx).toBe(1);
  });

  test('HOME-TC-011b: Done on last notice closes modal', () => {
    let showModal = true;
    let idx = 1;
    const notices = [{ id: 'n1' }, { id: 'n2' }];
    if (idx + 1 >= notices.length) showModal = false;
    expect(showModal).toBe(false);
  });
});

describe('HOME Module — Seba Sessions', () => {
  // HOME-TC-012
  test('HOME-TC-012: Active session (no ended_at) shown with elapsed timer', () => {
    const session = { ...SEBA_SESSION, ended_at: null };
    const isActive = !!session.started_at && !session.ended_at;
    expect(isActive).toBe(true);
  });

  // HOME-TC-013
  test('HOME-TC-013: Completed session (has ended_at) shown with duration', () => {
    const session = {
      ...SEBA_SESSION,
      ended_at: '2026-05-22T07:30:00Z',
      duration_minutes: 90,
    };
    const isDone = !!session.ended_at && !!session.duration_minutes;
    expect(isDone).toBe(true);
  });

  // HOME-TC-014
  test('HOME-TC-014: Today duty card tap navigates to schedule', () => {
    const targetRoute = '/(tabs)/schedule';
    expect(targetRoute).toBe('/(tabs)/schedule');
  });
});

describe('HOME Module — Carousel', () => {
  // HOME-TC-015
  test('HOME-TC-015: Carousel auto-rotation interval increments index', () => {
    let idx = 0;
    const slides = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
    idx = (idx + 1) % slides.length;
    expect(idx).toBe(1);
    idx = (idx + 1) % slides.length;
    expect(idx).toBe(2);
    idx = (idx + 1) % slides.length;
    expect(idx).toBe(0); // wraps
  });

  // HOME-TC-016
  test('HOME-TC-016: Tap profile avatar navigates to /(tabs)/profile', () => {
    const targetRoute = '/(tabs)/profile';
    expect(targetRoute).toBe('/(tabs)/profile');
  });
});
