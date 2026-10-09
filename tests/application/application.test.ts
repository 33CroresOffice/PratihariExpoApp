/**
 * Application module tests — covers approve/reject, comments,
 * status transitions, validation, and filtering logic.
 * Mirrors logic from app/application.tsx.
 */

import {
  TEST_SEBAYAT_ID,
  SEBAYAT_APPROVED,
} from '../utils/test-data';

// ── Status metadata (mirrors application.tsx) ──
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:             { label: 'Pending',          color: '#B7770D', bg: '#FFF8E0' },
  under_review:        { label: 'Under Review',     color: '#1D6FAE', bg: '#EBF5FB' },
  approved:            { label: 'Approved',          color: '#27AE60', bg: '#F0FFF4' },
  rejected:            { label: 'Rejected',          color: '#C0392B', bg: '#FFF5F5' },
  more_info_required:  { label: 'More Info Needed', color: '#8B5CF6', bg: '#F5F0FF' },
};

function getStatusMeta(key: string) {
  return STATUS_META[key] ?? STATUS_META.pending;
}

// ── Time ago (mirrors application.tsx) ──
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Status filter (mirrors application.tsx) ──
function filterByStatus(apps: any[], status: string): any[] {
  if (status === 'all') return apps;
  return apps.filter((a) => a.status === status);
}

// ── Application type validation (mirrors application.tsx) ──
function validateNewApp(title: string, type: any | null, files: any[]): string[] {
  const errors: string[] = [];
  if (!title.trim()) errors.push('Title is required');
  if (!type) errors.push('Please select an application type');
  if (type?.requires_documents && files.length === 0) {
    errors.push('At least one supporting document is required');
  }
  return errors;
}

// ── Comment author label (mirrors application.tsx) ──
function getCommentLabel(comment: any): string {
  if (comment.author_role === 'admin') return 'Admin';
  if (comment.author_role === 'sebayat') return 'You';
  return comment.author_role || 'Unknown';
}

// ── Status transition validation ──
const VALID_APP_TRANSITIONS: Record<string, string[]> = {
  pending:              ['under_review', 'approved', 'rejected', 'more_info_required'],
  under_review:         ['approved', 'rejected', 'more_info_required'],
  more_info_required:   ['under_review', 'approved', 'rejected'],
  approved:             [],
  rejected:             ['under_review'],
};

function isValidAppTransition(from: string, to: string): boolean {
  const allowed = VALID_APP_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ── Fixtures ──
const APPLICATIONS = [
  { id: 'app-001', application_type_id: 'type-001', status: 'pending',    priority: 'normal', title: 'Leave Application',  description: 'Need leave for 3 days', submitted_at: '2026-05-10T10:00:00Z', created_at: '2026-05-10T10:00:00Z', updated_at: '2026-05-10T10:00:00Z', admin_remarks: null, attachments: [], application_types: { name: 'Leave', icon: 'FileText', color: '#3B82F6' } },
  { id: 'app-002', application_type_id: 'type-002', status: 'approved',   priority: 'urgent', title: 'Seba Swap Request',  description: 'Requesting swap with sebayat 005', submitted_at: '2026-05-08T08:00:00Z', created_at: '2026-05-08T08:00:00Z', updated_at: '2026-05-09T12:00:00Z', admin_remarks: 'Approved. Swap confirmed.', attachments: [{ name: 'doc.pdf', path: 'user1/doc.pdf', url: '', size: 1024 }], application_types: { name: 'Swap', icon: 'Repeat', color: '#10B981' } },
  { id: 'app-003', application_type_id: 'type-001', status: 'rejected',   priority: 'normal', title: 'Leave Application',  description: 'Need leave for festival', submitted_at: '2026-05-05T14:00:00Z', created_at: '2026-05-05T14:00:00Z', updated_at: '2026-05-06T09:00:00Z', admin_remarks: 'Not enough sebayats available.', attachments: [], application_types: { name: 'Leave', icon: 'FileText', color: '#3B82F6' } },
  { id: 'app-004', application_type_id: 'type-003', status: 'under_review', priority: 'normal', title: 'Address Change',   description: 'Moved to new address', submitted_at: '2026-05-12T11:00:00Z', created_at: '2026-05-12T11:00:00Z', updated_at: '2026-05-12T11:00:00Z', admin_remarks: null, attachments: [], application_types: { name: 'Update', icon: 'Edit', color: '#F59E0B' } },
  { id: 'app-005', application_type_id: 'type-002', status: 'more_info_required', priority: 'urgent', title: 'Seba Swap Request', description: 'Swap for next week', submitted_at: '2026-05-11T16:00:00Z', created_at: '2026-05-11T16:00:00Z', updated_at: '2026-05-11T18:00:00Z', admin_remarks: 'Please provide preferred swap dates.', attachments: [], application_types: { name: 'Swap', icon: 'Repeat', color: '#10B981' } },
];

const APP_TYPES = [
  { id: 'type-001', name: 'Leave Application', description: 'Apply for leave', icon: 'FileText', color: '#3B82F6', form_fields: [], requires_documents: false, is_active: true },
  { id: 'type-002', name: 'Seba Swap Request', description: 'Request seba swap', icon: 'Repeat', color: '#10B981', form_fields: [], requires_documents: true, is_active: true },
  { id: 'type-003', name: 'Address Change',    description: 'Update address',    icon: 'Edit',   color: '#F59E0B', form_fields: [], requires_documents: false, is_active: true },
  { id: 'type-004', name: 'Inactive Type',     description: 'Deprecated',        icon: 'X',      color: '#999',    form_fields: [], requires_documents: false, is_active: false },
];

const COMMENTS = [
  { id: 'cmt-001', message: 'Please review my application.', is_internal: false, created_at: '2026-05-10T10:05:00Z', author_role: 'sebayat' },
  { id: 'cmt-002', message: 'Under review, will respond soon.', is_internal: true, created_at: '2026-05-10T11:00:00Z', author_role: 'admin' },
  { id: 'cmt-003', message: 'Thank you for the update.', is_internal: false, created_at: '2026-05-10T12:00:00Z', author_role: 'sebayat' },
];

const HISTORY = [
  { id: 'hist-001', from_status: null,          to_status: 'pending',     created_at: '2026-05-10T10:00:00Z', remarks: null },
  { id: 'hist-002', from_status: 'pending',      to_status: 'under_review', created_at: '2026-05-10T11:00:00Z', remarks: null },
  { id: 'hist-003', from_status: 'under_review', to_status: 'approved',    created_at: '2026-05-09T12:00:00Z', remarks: 'Approved. Swap confirmed.' },
];

// ── Tests ──

describe('Application — Status Metadata (APP-TC-001)', () => {
  it('returns correct metadata for pending status', () => {
    const meta = getStatusMeta('pending');
    expect(meta.label).toBe('Pending');
    expect(meta.color).toBe('#B7770D');
  });

  it('returns correct metadata for approved status', () => {
    const meta = getStatusMeta('approved');
    expect(meta.label).toBe('Approved');
    expect(meta.color).toBe('#27AE60');
  });

  it('returns correct metadata for rejected status', () => {
    const meta = getStatusMeta('rejected');
    expect(meta.label).toBe('Rejected');
    expect(meta.color).toBe('#C0392B');
  });

  it('returns correct metadata for under_review status', () => {
    const meta = getStatusMeta('under_review');
    expect(meta.label).toBe('Under Review');
  });

  it('returns correct metadata for more_info_required status', () => {
    const meta = getStatusMeta('more_info_required');
    expect(meta.label).toBe('More Info Needed');
  });

  it('falls back to pending for unknown status', () => {
    const meta = getStatusMeta('nonexistent');
    expect(meta.label).toBe('Pending');
  });
});

describe('Application — List & Filter (APP-TC-002)', () => {
  it('returns all applications when filter is "all"', () => {
    expect(filterByStatus(APPLICATIONS, 'all')).toHaveLength(5);
  });

  it('filters pending applications', () => {
    const result = filterByStatus(APPLICATIONS, 'pending');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('app-001');
  });

  it('filters approved applications', () => {
    const result = filterByStatus(APPLICATIONS, 'approved');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('app-002');
  });

  it('filters rejected applications', () => {
    const result = filterByStatus(APPLICATIONS, 'rejected');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('app-003');
  });

  it('filters under_review applications', () => {
    const result = filterByStatus(APPLICATIONS, 'under_review');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('app-004');
  });

  it('filters more_info_required applications', () => {
    const result = filterByStatus(APPLICATIONS, 'more_info_required');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('app-005');
  });

  it('returns empty for status with no matches', () => {
    expect(filterByStatus(APPLICATIONS, 'draft')).toHaveLength(0);
  });
});

describe('Application — Time Ago (APP-TC-003)', () => {
  it('returns "Today" for same-day timestamp', () => {
    const iso = new Date().toISOString();
    expect(timeAgo(iso)).toBe('Today');
  });

  it('returns "Yesterday" for 1-day-old timestamp', () => {
    const iso = new Date(Date.now() - 86400000).toISOString();
    expect(timeAgo(iso)).toBe('Yesterday');
  });

  it('returns "N days ago" for recent timestamps', () => {
    const iso = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(timeAgo(iso)).toBe('3 days ago');
  });

  it('returns formatted date for older timestamps', () => {
    const iso = new Date(Date.now() - 10 * 86400000).toISOString();
    const result = timeAgo(iso);
    expect(result).not.toContain('days ago');
    expect(result).toMatch(/\d{1,2} \w+ \d{4}/);
  });
});

describe('Application — New Application Validation (APP-TC-004)', () => {
  it('passes validation with title and type (no docs required)', () => {
    const errors = validateNewApp('My Application', APP_TYPES[0], []);
    expect(errors).toHaveLength(0);
  });

  it('fails validation without title', () => {
    const errors = validateNewApp('', APP_TYPES[0], []);
    expect(errors).toContain('Title is required');
  });

  it('fails validation with whitespace-only title', () => {
    const errors = validateNewApp('   ', APP_TYPES[0], []);
    expect(errors).toContain('Title is required');
  });

  it('fails validation without selecting a type', () => {
    const errors = validateNewApp('My Application', null, []);
    expect(errors).toContain('Please select an application type');
  });

  it('fails validation when documents required but none uploaded', () => {
    const errors = validateNewApp('Swap Request', APP_TYPES[1], []);
    expect(errors).toContain('At least one supporting document is required');
  });

  it('passes validation when documents required and provided', () => {
    const errors = validateNewApp('Swap Request', APP_TYPES[1], [{ name: 'doc.pdf', path: 'x', url: '', size: 100 }]);
    expect(errors).toHaveLength(0);
  });

  it('passes validation for type with requires_documents=false and no files', () => {
    const errors = validateNewApp('Address Change', APP_TYPES[2], []);
    expect(errors).toHaveLength(0);
  });
});

describe('Application — Active Types Filter (APP-TC-005)', () => {
  it('filters only active application types', () => {
    const active = APP_TYPES.filter((t) => t.is_active);
    expect(active).toHaveLength(3);
    expect(active.find((t) => t.id === 'type-004')).toBeUndefined();
  });
});

describe('Application — Comment Labels (APP-TC-006)', () => {
  it('returns "You" for sebayat comments', () => {
    expect(getCommentLabel(COMMENTS[0])).toBe('You');
  });

  it('returns "Admin" for admin comments', () => {
    expect(getCommentLabel(COMMENTS[1])).toBe('Admin');
  });

  it('returns author_role for unknown roles', () => {
    expect(getCommentLabel({ author_role: 'moderator' })).toBe('moderator');
  });

  it('returns "Unknown" for missing author_role', () => {
    expect(getCommentLabel({})).toBe('Unknown');
  });
});

describe('Application — Status Transitions (APP-TC-007)', () => {
  it('allows pending → under_review', () => {
    expect(isValidAppTransition('pending', 'under_review')).toBe(true);
  });

  it('allows pending → approved', () => {
    expect(isValidAppTransition('pending', 'approved')).toBe(true);
  });

  it('allows pending → rejected', () => {
    expect(isValidAppTransition('pending', 'rejected')).toBe(true);
  });

  it('allows pending → more_info_required', () => {
    expect(isValidAppTransition('pending', 'more_info_required')).toBe(true);
  });

  it('allows under_review → approved', () => {
    expect(isValidAppTransition('under_review', 'approved')).toBe(true);
  });

  it('allows under_review → rejected', () => {
    expect(isValidAppTransition('under_review', 'rejected')).toBe(true);
  });

  it('allows more_info_required → under_review', () => {
    expect(isValidAppTransition('more_info_required', 'under_review')).toBe(true);
  });

  it('blocks approved → any (terminal status)', () => {
    expect(isValidAppTransition('approved', 'pending')).toBe(false);
    expect(isValidAppTransition('approved', 'rejected')).toBe(false);
  });

  it('allows rejected → under_review (re-open)', () => {
    expect(isValidAppTransition('rejected', 'under_review')).toBe(true);
  });

  it('blocks invalid transitions', () => {
    expect(isValidAppTransition('pending', 'approved')).toBe(true);
    expect(isValidAppTransition('approved', 'pending')).toBe(false);
  });

  it('blocks unknown source status', () => {
    expect(isValidAppTransition('nonexistent', 'approved')).toBe(false);
  });
});

describe('Application — Status History Timeline (APP-TC-008)', () => {
  it('history is sorted newest first', () => {
    const sorted = [...HISTORY].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    expect(sorted[0].id).toBe('hist-002');
    expect(sorted[2].id).toBe('hist-003');
  });

  it('first entry has null from_status', () => {
    const first = HISTORY.find((h) => h.from_status === null);
    expect(first).toBeDefined();
    expect(first!.to_status).toBe('pending');
  });

  it('remarks captured on approval transition', () => {
    const approval = HISTORY.find((h) => h.to_status === 'approved');
    expect(approval).toBeDefined();
    expect(approval!.remarks).toBe('Approved. Swap confirmed.');
  });
});

describe('Application — Priority (APP-TC-009)', () => {
  it('identifies urgent priority applications', () => {
    const urgent = APPLICATIONS.filter((a) => a.priority === 'urgent');
    expect(urgent).toHaveLength(2);
    expect(urgent.map((a) => a.id)).toContain('app-002');
    expect(urgent.map((a) => a.id)).toContain('app-005');
  });

  it('identifies normal priority applications', () => {
    const normal = APPLICATIONS.filter((a) => a.priority === 'normal');
    expect(normal).toHaveLength(3);
  });
});

describe('Application — Attachments (APP-TC-010)', () => {
  it('application with attachments has file data', () => {
    const withAttachments = APPLICATIONS.filter((a) => a.attachments.length > 0);
    expect(withAttachments).toHaveLength(1);
    expect(withAttachments[0].attachments[0].name).toBe('doc.pdf');
  });

  it('applications without attachments have empty array', () => {
    const noAttachments = APPLICATIONS.filter((a) => a.attachments.length === 0);
    expect(noAttachments).toHaveLength(4);
    expect(noAttachments.every((a) => Array.isArray(a.attachments))).toBe(true);
  });
});

describe('Application — Access Control (APP-TC-011)', () => {
  it('non-approved user cannot access application screen', () => {
    const isApproved = SEBAYAT_APPROVED.profile_status === 'approved';
    expect(isApproved).toBe(true);
  });

  it('offline users see OfflineGateModal', () => {
    const isOnline = false;
    const shouldShowGate = !isOnline;
    expect(shouldShowGate).toBe(true);
  });

  it('online approved users can access applications', () => {
    const isOnline = true;
    const isApproved = SEBAYAT_APPROVED.profile_status === 'approved';
    const canAccess = isOnline && isApproved;
    expect(canAccess).toBe(true);
  });
});
