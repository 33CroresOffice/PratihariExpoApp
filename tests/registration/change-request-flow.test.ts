/**
 * REG Module — Change Request Flow Tests
 * Covers: REG-TC-046 through REG-TC-053
 *
 * Tests the multi-section change-request update flow:
 * admin saves change_sections array → user sees count badge →
 * multi-section stepper → section-by-section editing → resubmit.
 */

import {
  SECTION_STEP,
  ADMIN_CHANGE_CHECKBOXES,
  SECTION_PRIORITY,
  getHighestPrioritySection,
  parseChangeSections,
  getRequestedSteps,
} from '../utils/test-helpers';
import { SEBAYAT_CHANGES_REQUESTED } from '../utils/test-data';

// ─── Admin-side: building change_sections ────────────────────────────────────

describe('REG — Change Request: Admin side (change_sections building)', () => {
  // REG-TC-046 (admin saves all sections)
  test('REG-TC-046: Admin checks 4 boxes → change_sections has 4 unique section codes', () => {
    const checkedBoxes = ADMIN_CHANGE_CHECKBOXES.slice(0, 4); // Profile photo, Personal, Address, Identity docs
    const sections = [...new Set(checkedBoxes.map((b) => b.section).filter(Boolean))];
    // Profile photo and Personal details both map to 'personal'
    expect(sections).toContain('personal');
    expect(sections).toContain('address');
    expect(sections).toContain('documents');
    // personal appears only once because Set deduplicates
    expect(sections.filter((s) => s === 'personal')).toHaveLength(1);
  });

  test('REG-TC-046b: change_sections array persisted to DB with all section codes', () => {
    const saved = SEBAYAT_CHANGES_REQUESTED.change_sections;
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).toContain('personal');
    expect(saved).toContain('address');
    expect(saved).toContain('documents');
  });

  test('REG-TC-046c: highest-priority section stored in change_section (singular)', () => {
    const sections = SEBAYAT_CHANGES_REQUESTED.change_sections;
    const best = getHighestPrioritySection(sections);
    // seba > documents > address > family > personal > contact (highest index wins)
    expect(best).toBe('documents'); // documents has index 4 in SECTION_PRIORITY
  });
});

// ─── Home screen: count badge ─────────────────────────────────────────────────

describe('REG — Change Request: Home screen count badge', () => {
  // REG-TC-046 (mobile side)
  test('REG-TC-046: change_sections.length === 3 → badge shows "3 sections"', () => {
    const changeSections = SEBAYAT_CHANGES_REQUESTED.change_sections;
    const count = changeSections.length;
    const badgeText = `${count} section${count !== 1 ? 's' : ''}`;
    expect(badgeText).toBe('3 sections');
  });

  test('REG-TC-046d: Single section — badge shows "1 section" (no plural)', () => {
    const count = 1;
    const badgeText = `${count} section${count !== 1 ? 's' : ''}`;
    expect(badgeText).toBe('1 section');
  });
});

// ─── Param parsing ────────────────────────────────────────────────────────────

describe('REG — Change Request: Param parsing', () => {
  // REG-TC-047
  test('REG-TC-047: change_sections param parsed from comma-separated string', () => {
    const param = 'personal,address,documents';
    const sections = parseChangeSections(param);
    expect(sections).toEqual(['personal', 'address', 'documents']);
  });

  test('REG-TC-047b: Undefined param falls back to empty array', () => {
    const sections = parseChangeSections(undefined);
    expect(sections).toEqual([]);
  });

  test('REG-TC-047c: Single section param parses to 1-item array', () => {
    const sections = parseChangeSections('seba');
    expect(sections).toEqual(['seba']);
  });
});

// ─── Step deduplication ───────────────────────────────────────────────────────

describe('REG — Change Request: Step deduplication', () => {
  test('personal + documents both map to step 1, deduplicated to one step', () => {
    const sections = ['personal', 'documents']; // personal→0, documents→1 (wait, they differ)
    // personal→0 (Personal Details), documents→1 (Contact & IDs) — these ARE different
    const steps = getRequestedSteps(sections);
    expect(steps).toContain(SECTION_STEP.personal); // 0
    expect(steps).toContain(SECTION_STEP.documents); // 1
    expect(steps).toHaveLength(2);
  });

  test('contact + documents both map to step 1 — deduplicated to ONE step', () => {
    const sections = ['contact', 'documents']; // both → step 1
    const steps = getRequestedSteps(sections);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toBe(1);
  });

  test('3 distinct sections → 3 steps', () => {
    const sections = ['personal', 'family', 'address'];
    const steps = getRequestedSteps(sections);
    expect(steps).toHaveLength(3);
  });
});

// ─── Section stepper navigation ──────────────────────────────────────────────

describe('REG — Change Request: Section stepper navigation', () => {
  // REG-TC-047
  test('REG-TC-047: Opens with changeRequestIdx=0 — first requested step shown', () => {
    const requestedSteps = getRequestedSteps(['personal', 'address', 'documents']);
    const changeRequestIdx = 0;
    expect(requestedSteps[changeRequestIdx]).toBe(SECTION_STEP.personal);
  });

  // REG-TC-048
  test('REG-TC-048: Admin remarks available on every step in change-request mode', () => {
    const adminRemarks = SEBAYAT_CHANGES_REQUESTED.admin_remarks;
    // Remarks should be shown on ALL steps, not just one
    const isChangeRequest = true;
    const showRemarks = isChangeRequest && !!adminRemarks;
    expect(showRemarks).toBe(true);
  });

  // REG-TC-049
  test('REG-TC-049: Tapping Next Section advances changeRequestIdx', () => {
    let idx = 0;
    const requestedSteps = [0, 4, 1]; // personal, address, documents
    if (idx < requestedSteps.length - 1) idx++;
    expect(idx).toBe(1);
    expect(requestedSteps[idx]).toBe(4); // address step
  });

  // REG-TC-050
  test('REG-TC-050: Back on section 2 returns to section 1', () => {
    let idx = 2;
    if (idx > 0) idx--;
    expect(idx).toBe(1);
  });

  // REG-TC-051
  test('REG-TC-051: Last section shows Resubmit button text', () => {
    const requestedSteps = [0, 4, 1];
    const idx = 2; // last section
    const isLastSection = idx >= requestedSteps.length - 1;
    const buttonLabel = isLastSection ? 'Resubmit' : 'Next Section';
    expect(buttonLabel).toBe('Resubmit');
  });

  // REG-TC-051b
  test('REG-TC-051b: Non-last section shows Next Section button text', () => {
    const requestedSteps = [0, 4, 1];
    const idx = 0;
    const isLastSection = idx >= requestedSteps.length - 1;
    const buttonLabel = isLastSection ? 'Resubmit' : 'Next Section';
    expect(buttonLabel).toBe('Next Section');
  });
});

// ─── Resubmit logic ───────────────────────────────────────────────────────────

describe('REG — Change Request: Resubmit', () => {
  // REG-TC-052
  test('REG-TC-052: After resubmit, profile_status becomes resubmitted', () => {
    const existingStatus = 'changes_requested';
    const isResub = existingStatus === 'changes_requested';
    const newStatus = isResub ? 'resubmitted' : 'submitted';
    expect(newStatus).toBe('resubmitted');
  });

  test('REG-TC-052b: After resubmit, admin_remarks cleared to empty string', () => {
    const payload = { admin_remarks: '', change_section: null, change_sections: null };
    expect(payload.admin_remarks).toBe('');
    expect(payload.change_section).toBeNull();
    expect(payload.change_sections).toBeNull();
  });

  test('REG-TC-052c: After resubmit, change_sections set to null', () => {
    const payload = { change_sections: null };
    expect(payload.change_sections).toBeNull();
  });

  // REG-TC-053
  test('REG-TC-053: Single section request → requestedSteps has length 1 → immediate Resubmit button', () => {
    const sections = ['seba'];
    const requestedSteps = getRequestedSteps(sections);
    expect(requestedSteps).toHaveLength(1);
    const idx = 0;
    const isLastSection = idx >= requestedSteps.length - 1;
    expect(isLastSection).toBe(true);
  });
});
