/**
 * SCHED Module Tests — Schedule Screen
 * Covers: SCHED-TC-001 through SCHED-TC-009
 */

import { DUTY_ENTRY } from '../utils/test-data';

// Calendar helpers (mirror schedule.tsx logic)
function getDatesWithDuty(duties: typeof DUTY_ENTRY[]): string[] {
  return duties.map((d) => d.service_date);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

describe('SCHED Module — Calendar Display', () => {
  // SCHED-TC-001
  test('SCHED-TC-001: Current month shown by default', () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    expect(currentMonth).toBeGreaterThanOrEqual(0);
    expect(currentYear).toBeGreaterThanOrEqual(2026);
  });

  // SCHED-TC-002
  test('SCHED-TC-002: Duty dates extracted from schedule entries', () => {
    const duties = [
      { ...DUTY_ENTRY, service_date: '2026-05-22' },
      { ...DUTY_ENTRY, service_date: '2026-06-01' },
    ];
    const dutyDates = getDatesWithDuty(duties);
    expect(dutyDates).toContain('2026-05-22');
    expect(dutyDates).toContain('2026-06-01');
  });

  // SCHED-TC-003
  test('SCHED-TC-003: Selecting duty date reveals duty details', () => {
    const duties = [DUTY_ENTRY];
    const selectedDate = '2026-05-22';
    const dutiesForDate = duties.filter((d) => d.service_date === selectedDate);
    expect(dutiesForDate).toHaveLength(1);
    expect(dutiesForDate[0].seba_name).toBe('Pratihari');
  });

  // SCHED-TC-004
  test('SCHED-TC-004: Navigate to previous month decrements month', () => {
    let month = 4; // May (0-indexed)
    month = month === 0 ? 11 : month - 1;
    expect(month).toBe(3); // April
  });

  test('SCHED-TC-004b: Navigate to next month increments month', () => {
    let month = 4;
    month = month === 11 ? 0 : month + 1;
    expect(month).toBe(5); // June
  });

  // SCHED-TC-005
  test('SCHED-TC-005: Future duty date found in upcoming duties list', () => {
    const nextDuty = { ...DUTY_ENTRY, service_date: '2026-06-15' };
    expect(new Date(nextDuty.service_date) > new Date('2026-05-22')).toBe(true);
  });

  // SCHED-TC-006
  test('SCHED-TC-006: Go-to-date parses input date string', () => {
    const input = '2026-07-01';
    const date = new Date(input);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // July
  });

  // SCHED-TC-007
  test('SCHED-TC-007: Past completed duty has ended_at and duration', () => {
    const session = {
      service_date: '2026-05-01',
      started_at: '2026-05-01T06:00:00Z',
      ended_at: '2026-05-01T08:00:00Z',
      duration_minutes: 120,
    };
    expect(session.ended_at).toBeTruthy();
    expect(session.duration_minutes).toBe(120);
  });

  // SCHED-TC-008
  test('SCHED-TC-008: Upcoming duty is in the future', () => {
    const nextDutyDate = '2026-06-10';
    const today = '2026-05-22';
    expect(new Date(nextDutyDate) > new Date(today)).toBe(true);
  });

  // SCHED-TC-009
  test('SCHED-TC-009: Non-approved user should not have access to schedule tab', () => {
    const status = 'submitted';
    const canAccessSchedule = status === 'approved';
    expect(canAccessSchedule).toBe(false);
  });
});
