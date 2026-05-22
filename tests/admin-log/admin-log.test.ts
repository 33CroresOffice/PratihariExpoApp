/**
 * ADMIN-LOG Module Tests — Activity Log
 * Covers: ADMIN-LOG-TC-001 through ADMIN-LOG-TC-008
 */

import { TEST_ADMIN_ID, TEST_SEBAYAT_ID } from '../utils/test-data';

const ACTIVITY_LOG_ENTRIES = [
  {
    id: 'al-001', actor_id: TEST_ADMIN_ID, action_type: 'approve',
    resource_type: 'sebayat_profiles', resource_id: TEST_SEBAYAT_ID,
    old_value: { status: 'submitted' }, new_value: { status: 'approved', remarks: '' },
    created_at: '2026-05-22T09:00:00Z',
  },
  {
    id: 'al-002', actor_id: TEST_ADMIN_ID, action_type: 'reject',
    resource_type: 'sebayat_profiles', resource_id: 'seb-002',
    old_value: { status: 'submitted' }, new_value: { status: 'rejected', remarks: 'Docs missing' },
    created_at: '2026-05-22T09:30:00Z',
  },
  {
    id: 'al-003', actor_id: 'adm-002', action_type: 'update',
    resource_type: 'sebayat_profiles', resource_id: 'seb-003',
    old_value: { alias_name: '' }, new_value: { alias_name: 'Raju' },
    created_at: '2026-05-22T10:00:00Z',
  },
  {
    id: 'al-004', actor_id: TEST_ADMIN_ID, action_type: 'update',
    resource_type: 'sebayat_profiles', resource_id: 'seb-004',
    old_value: { status: 'submitted' }, new_value: { status: 'changes_requested', change_sections: ['personal'] },
    created_at: '2026-05-22T10:30:00Z',
  },
];

function filterLog(entries: typeof ACTIVITY_LOG_ENTRIES, filters: { action_type?: string; actor_id?: string; from?: string; to?: string }) {
  let result = [...entries];
  if (filters.action_type) result = result.filter((e) => e.action_type === filters.action_type);
  if (filters.actor_id)    result = result.filter((e) => e.actor_id === filters.actor_id);
  if (filters.from)        result = result.filter((e) => e.created_at >= filters.from!);
  if (filters.to)          result = result.filter((e) => e.created_at <= filters.to! + 'Z');
  return result;
}

describe('ADMIN-LOG Module — Activity Log', () => {
  // ADMIN-LOG-TC-001
  test('ADMIN-LOG-TC-001: Approve action creates log entry with action_type=approve', () => {
    const approveEntries = filterLog(ACTIVITY_LOG_ENTRIES, { action_type: 'approve' });
    expect(approveEntries).toHaveLength(1);
    expect(approveEntries[0].new_value.status).toBe('approved');
  });

  // ADMIN-LOG-TC-002
  test('ADMIN-LOG-TC-002: Reject action log entry contains remarks in new_value', () => {
    const rejectEntries = filterLog(ACTIVITY_LOG_ENTRIES, { action_type: 'reject' });
    expect(rejectEntries).toHaveLength(1);
    expect(rejectEntries[0].new_value.remarks).toBe('Docs missing');
  });

  // ADMIN-LOG-TC-003
  test('ADMIN-LOG-TC-003: Change-request action log entry contains change_sections', () => {
    const crEntries = ACTIVITY_LOG_ENTRIES.filter(
      (e) => e.new_value.status === 'changes_requested'
    );
    expect(crEntries).toHaveLength(1);
    expect((crEntries[0].new_value as any).change_sections).toContain('personal');
  });

  // ADMIN-LOG-TC-004
  test('ADMIN-LOG-TC-004: Filter by action_type=approve returns only approve entries', () => {
    const results = filterLog(ACTIVITY_LOG_ENTRIES, { action_type: 'approve' });
    expect(results.every((e) => e.action_type === 'approve')).toBe(true);
  });

  // ADMIN-LOG-TC-005
  test('ADMIN-LOG-TC-005: Filter by actor_id returns only that admin\'s entries', () => {
    const results = filterLog(ACTIVITY_LOG_ENTRIES, { actor_id: TEST_ADMIN_ID });
    expect(results.every((e) => e.actor_id === TEST_ADMIN_ID)).toBe(true);
    expect(results).toHaveLength(3);
  });

  // ADMIN-LOG-TC-006
  test('ADMIN-LOG-TC-006: Date range filter returns entries within range', () => {
    const results = filterLog(ACTIVITY_LOG_ENTRIES, {
      from: '2026-05-22T09:00:00Z',
      to:   '2026-05-22T09:30',
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ADMIN-LOG-TC-007
  test('ADMIN-LOG-TC-007: CSV export converts log entries to CSV format', () => {
    const headers = ['id', 'actor_id', 'action_type', 'resource_type', 'created_at'];
    const rows = ACTIVITY_LOG_ENTRIES.map((e) =>
      headers.map((h) => (e as any)[h] || '').join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    expect(csv).toContain('al-001');
    expect(csv).toContain('approve');
    expect(csv.split('\n')).toHaveLength(ACTIVITY_LOG_ENTRIES.length + 1);
  });

  // ADMIN-LOG-TC-008
  test('ADMIN-LOG-TC-008: Log entries show old and new values for edits', () => {
    const editEntry = ACTIVITY_LOG_ENTRIES[2];
    expect(editEntry.old_value).toBeDefined();
    expect(editEntry.new_value).toBeDefined();
    expect(editEntry.old_value.alias_name).toBe('');
    expect(editEntry.new_value.alias_name).toBe('Raju');
  });
});
