/**
 * Shared helper functions for test assertions and setup.
 */

/** Build a mock Supabase query chain that resolves with the given data/error */
export function mockQueryResult(data: any, error: any = null) {
  const chain: any = {
    data,
    error,
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  };
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: any) => Promise.resolve({ data, error }).then(resolve),
  });
  return chain;
}

/** Assert a mock was called with a specific subset of args (partial match) */
export function expectCalledWith(mockFn: jest.Mock, ...expectedArgs: any[]) {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
}

/** Flush all promises in the current microtask queue */
export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Generate a phone number that fails 10-digit validation */
export const INVALID_PHONE_SHORT = '98765';
export const INVALID_PHONE_ALPHA = 'abcdefghij';

/** Common validation error messages (mirrors register.tsx logic) */
export const VALIDATION_ERRORS = {
  required: 'Required',
  pleaseSelect: 'Please select',
  phone10Digit: '10-digit phone number required',
  pincode6Digit: '6-digit PIN required',
  atLeastOneId: 'At least one identity card is required',
  joiningDateRequired: 'Joining date is required',
  joiningYearRequired: 'Joining year is required',
  sebaRequired: 'Please select at least one seba beddha',
  spouseRequired: 'Required when married',
};

/** Section code → STEPS index map (mirrors register.tsx) */
export const SECTION_STEP: Record<string, number> = {
  personal: 0,
  contact: 1,
  documents: 1,
  seba: 2,
  family: 3,
  address: 4,
};

/** Section codes as saved in change_sections */
export const ALL_SECTION_CODES = ['personal', 'contact', 'documents', 'seba', 'family', 'address'];

/** Admin dashboard section checkbox data (mirrors app.js) */
export const ADMIN_CHANGE_CHECKBOXES = [
  { label: 'Profile photo', line: 'Profile photo needs to be re-uploaded.', section: 'personal' },
  { label: 'Personal details', line: 'Personal details (name, DOB, etc.) need updating.', section: 'personal' },
  { label: 'Address details', line: 'Address details are incomplete or incorrect.', section: 'address' },
  { label: 'Identity documents', line: 'Identity documents need to be re-uploaded.', section: 'documents' },
  { label: 'Seba details', line: 'Seba/bansa/palia details need correction.', section: 'seba' },
  { label: 'Family details', line: 'Family details need updating.', section: 'family' },
];

export const SECTION_PRIORITY = ['contact', 'personal', 'family', 'address', 'documents', 'seba'];

/** Determine highest-priority section given checked sections (mirrors app.js logic) */
export function getHighestPrioritySection(sections: string[]): string | null {
  if (!sections.length) return null;
  return [...sections].sort(
    (a, b) => SECTION_PRIORITY.indexOf(b) - SECTION_PRIORITY.indexOf(a)
  )[0];
}

/** Parse comma-separated change_sections param (mirrors register.tsx) */
export function parseChangeSections(param: string | undefined): string[] {
  if (!param) return [];
  return param.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Get unique step indices for a list of section codes */
export function getRequestedSteps(sections: string[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const sec of sections) {
    const idx = SECTION_STEP[sec];
    if (idx !== undefined && !seen.has(idx)) {
      seen.add(idx);
      result.push(idx);
    }
  }
  return result.length ? result : [0];
}
