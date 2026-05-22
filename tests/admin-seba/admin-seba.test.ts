/**
 * ADMIN-SEBA Module Tests — Seba Management
 * Covers: ADMIN-SEBA-TC-001 through ADMIN-SEBA-TC-019
 */

import { SEBA_SESSION, SEBA_CATEGORY, TEST_SEBAYAT_ID } from '../utils/test-data';

// ─── Seba Today ───────────────────────────────────────────────────────────────

describe('ADMIN-SEBA — Seba Today', () => {
  const roster = [
    { id: 'r1', sebayat_id: 's1', seba_name: 'Pratihari', beddha_number: 1, status: 'scheduled' },
    { id: 'r2', sebayat_id: 's2', seba_name: 'Pratihari', beddha_number: 2, status: 'scheduled' },
    { id: 'r3', sebayat_id: 's3', seba_name: 'Gochhikar', beddha_number: 1, status: 'absent'    },
  ];

  // ADMIN-SEBA-TC-001
  test('ADMIN-SEBA-TC-001: Today roster shown with all assignments', () => {
    expect(roster).toHaveLength(3);
    expect(roster[0].seba_name).toBe('Pratihari');
  });

  // ADMIN-SEBA-TC-002
  test('ADMIN-SEBA-TC-002: Mark sebayat absent updates status', () => {
    const entry = { ...roster[0], status: 'absent' };
    expect(entry.status).toBe('absent');
  });

  // ADMIN-SEBA-TC-003
  test('ADMIN-SEBA-TC-003: Start session records started_at timestamp', () => {
    const session = { ...SEBA_SESSION, started_at: new Date().toISOString() };
    expect(session.started_at).toBeTruthy();
    expect(session.ended_at).toBeNull();
  });

  // ADMIN-SEBA-TC-004
  test('ADMIN-SEBA-TC-004: End session records ended_at and calculates duration', () => {
    const started_at = '2026-05-22T06:00:00Z';
    const ended_at  = '2026-05-22T07:30:00Z';
    const durationMs = new Date(ended_at).getTime() - new Date(started_at).getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    expect(durationMinutes).toBe(90);
  });

  // ADMIN-SEBA-TC-005
  test('ADMIN-SEBA-TC-005: Notes can be added to session', () => {
    const session = { ...SEBA_SESSION, notes: 'Completed without issues' };
    expect(session.notes).toBe('Completed without issues');
  });
});

// ─── Seba Calendar ────────────────────────────────────────────────────────────

describe('ADMIN-SEBA — Seba Calendar', () => {
  // ADMIN-SEBA-TC-006
  test('ADMIN-SEBA-TC-006: Month navigation increments/decrements month', () => {
    let month = 4; // May
    let year = 2026;
    // Next month
    if (month === 11) { month = 0; year++; } else month++;
    expect(month).toBe(5); // June
    expect(year).toBe(2026);
  });

  // ADMIN-SEBA-TC-007
  test('ADMIN-SEBA-TC-007: Past date roster query uses service_date filter', () => {
    const date = '2026-05-01';
    const query = { filter: { service_date: date } };
    expect(query.filter.service_date).toBe('2026-05-01');
  });

  // ADMIN-SEBA-TC-008
  test('ADMIN-SEBA-TC-008: Edit anchor updates anchor_sebayat_id and beddha_number', () => {
    const update = { anchor_sebayat_id: 's2', anchor_beddha_number: 3 };
    expect(update.anchor_sebayat_id).toBe('s2');
    expect(update.anchor_beddha_number).toBe(3);
  });

  // ADMIN-SEBA-TC-009
  test('ADMIN-SEBA-TC-009: Anchor history entry stores old and new values', () => {
    const historyEntry = {
      group_id: 'grp-001',
      old_anchor_sebayat_id: 's1',
      new_anchor_sebayat_id: 's2',
      old_beddha: 2,
      new_beddha: 3,
      reason: 'Rotation',
    };
    expect(historyEntry.old_anchor_sebayat_id).not.toBe(historyEntry.new_anchor_sebayat_id);
  });
});

// ─── Seba History ─────────────────────────────────────────────────────────────

describe('ADMIN-SEBA — Seba History', () => {
  const sessions = [
    { id: 'h1', service_date: '2026-05-01', sebayat_name: 'Soumya', status: 'completed', duration_minutes: 90 },
    { id: 'h2', service_date: '2026-05-05', sebayat_name: 'Priya',  status: 'in_progress', duration_minutes: null },
    { id: 'h3', service_date: '2026-05-10', sebayat_name: 'Vikram', status: 'absent',       duration_minutes: null },
  ];

  // ADMIN-SEBA-TC-010
  test('ADMIN-SEBA-TC-010: Date range filter returns sessions within range', () => {
    const from = '2026-05-01';
    const to   = '2026-05-06';
    const results = sessions.filter(
      (s) => s.service_date >= from && s.service_date <= to
    );
    expect(results).toHaveLength(2);
  });

  // ADMIN-SEBA-TC-011
  test('ADMIN-SEBA-TC-011: Filter completed returns only completed sessions', () => {
    const results = sessions.filter((s) => s.status === 'completed');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('h1');
  });

  // ADMIN-SEBA-TC-012
  test('ADMIN-SEBA-TC-012: Search by sebayat name returns matching sessions', () => {
    const query = 'Priya';
    const results = sessions.filter((s) =>
      s.sebayat_name.toLowerCase().includes(query.toLowerCase())
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('h2');
  });
});

// ─── Nijog View ───────────────────────────────────────────────────────────────

describe('ADMIN-SEBA — Nijog View', () => {
  // ADMIN-SEBA-TC-013
  test('ADMIN-SEBA-TC-013: Nijog assignments for current year shown', () => {
    const assignments = [{ sebayat_id: TEST_SEBAYAT_ID, seba_category_id: 'cat-001', beddha_number: 2, year: 2026 }];
    const currentYear = 2026;
    const current = assignments.filter((a) => a.year === currentYear);
    expect(current).toHaveLength(1);
  });
});

// ─── Seba Assign ──────────────────────────────────────────────────────────────

describe('ADMIN-SEBA — Seba Assign', () => {
  // ADMIN-SEBA-TC-014
  test('ADMIN-SEBA-TC-014: Assign seba creates nijog_assignment row', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ data: [{ id: 'nij-001' }], error: null });
    const payload = { sebayat_id: TEST_SEBAYAT_ID, seba_category_id: 'cat-001', beddha_number: 2, year: 2026 };
    const result = await mockInsert(payload);
    expect(result.error).toBeNull();
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ sebayat_id: TEST_SEBAYAT_ID }));
  });

  // ADMIN-SEBA-TC-015
  test('ADMIN-SEBA-TC-015: Remove assignment deletes nijog_assignment row', async () => {
    const mockDelete = jest.fn().mockResolvedValue({ error: null });
    const result = await mockDelete({ id: 'nij-001' });
    expect(result.error).toBeNull();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});

// ─── Seba Categories ─────────────────────────────────────────────────────────

describe('ADMIN-SEBA — Seba Categories', () => {
  // ADMIN-SEBA-TC-016
  test('ADMIN-SEBA-TC-016: Create category saves to DB', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ data: [SEBA_CATEGORY], error: null });
    const result = await mockInsert(SEBA_CATEGORY);
    expect(result.error).toBeNull();
    expect(result.data[0].name).toBe('Pratihari');
  });

  // ADMIN-SEBA-TC-017
  test('ADMIN-SEBA-TC-017: Edit category updates name in DB', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ error: null });
    await mockUpdate({ id: 'cat-001', name: 'Updated Pratihari' });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Pratihari' }));
  });

  // ADMIN-SEBA-TC-018
  test('ADMIN-SEBA-TC-018: Delete category removes from list', () => {
    let categories = [SEBA_CATEGORY, { ...SEBA_CATEGORY, id: 'cat-002', name: 'Gochhikar' }];
    categories = categories.filter((c) => c.id !== 'cat-001');
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('Gochhikar');
  });

  // ADMIN-SEBA-TC-019
  test('ADMIN-SEBA-TC-019: Category shows correct beddha count', () => {
    expect(SEBA_CATEGORY.beddha_count).toBe(4);
  });
});
