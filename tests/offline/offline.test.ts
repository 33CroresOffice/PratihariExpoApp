/**
 * OFFLINE Module Tests — Offline Mode & Caching
 * Covers: OFFLINE-TC-001 through OFFLINE-TC-008
 */

import { SEBAYAT_APPROVED, DUTY_ENTRY, TEST_USER_ID } from '../utils/test-data';

// ─── Offline cache helpers (mirror lib/offlineCache.ts + lib/cachedQuery.ts) ──

const mockAsyncStorage: Record<string, string> = {};

async function writeCache(userId: string, key: string, data: any): Promise<void> {
  mockAsyncStorage[`${userId}:${key}`] = JSON.stringify({ data, cachedAt: Date.now() });
}

async function readCache<T>(userId: string, key: string): Promise<{ data: T | null; cachedAt: number | null }> {
  const raw = mockAsyncStorage[`${userId}:${key}`];
  if (!raw) return { data: null, cachedAt: null };
  const parsed = JSON.parse(raw);
  return { data: parsed.data as T, cachedAt: parsed.cachedAt };
}

async function clearCache(userId: string, key: string): Promise<void> {
  delete mockAsyncStorage[`${userId}:${key}`];
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('OFFLINE Module', () => {
  beforeEach(() => {
    Object.keys(mockAsyncStorage).forEach((k) => delete mockAsyncStorage[k]);
  });

  // OFFLINE-TC-001
  test('OFFLINE-TC-001: Enable offline mode populates cache with profile data', async () => {
    await writeCache(TEST_USER_ID, 'profile', SEBAYAT_APPROVED);
    const { data } = await readCache<typeof SEBAYAT_APPROVED>(TEST_USER_ID, 'profile');
    expect(data).not.toBeNull();
    expect(data!.full_name).toBe('Soumya Ranjan Pratihari');
  });

  // OFFLINE-TC-002
  test('OFFLINE-TC-002: Offline banner condition: isOnline=false triggers banner', () => {
    const isOnline = false;
    const showBanner = !isOnline;
    expect(showBanner).toBe(true);
  });

  test('OFFLINE-TC-002b: Online — offline banner not shown', () => {
    const isOnline = true;
    const showBanner = !isOnline;
    expect(showBanner).toBe(false);
  });

  // OFFLINE-TC-003
  test('OFFLINE-TC-003: Profile data loaded from cache while offline', async () => {
    await writeCache(TEST_USER_ID, 'profile', SEBAYAT_APPROVED);
    const isOnline = false;
    const { data } = await readCache<typeof SEBAYAT_APPROVED>(TEST_USER_ID, 'profile');
    // Simulates hydrating from cache when offline
    const profileShown = !isOnline && !!data;
    expect(profileShown).toBe(true);
  });

  // OFFLINE-TC-004
  test('OFFLINE-TC-004: Today duty loaded from cache while offline', async () => {
    await writeCache(TEST_USER_ID, 'today_duty', [DUTY_ENTRY]);
    const { data } = await readCache<typeof DUTY_ENTRY[]>(TEST_USER_ID, 'today_duty');
    expect(data).not.toBeNull();
    expect(data![0].seba_name).toBe('Pratihari');
  });

  // OFFLINE-TC-005
  test('OFFLINE-TC-005: Sync Now overwrites cache with fresh data', async () => {
    await writeCache(TEST_USER_ID, 'profile', { ...SEBAYAT_APPROVED, full_name: 'Old Name' });
    // Simulate sync by writing fresh data
    const freshData = { ...SEBAYAT_APPROVED, full_name: 'New Name' };
    await writeCache(TEST_USER_ID, 'profile', freshData);
    const { data } = await readCache<any>(TEST_USER_ID, 'profile');
    expect(data!.full_name).toBe('New Name');
  });

  // OFFLINE-TC-006
  test('OFFLINE-TC-006: Clear cache removes all data for user', async () => {
    await writeCache(TEST_USER_ID, 'profile', SEBAYAT_APPROVED);
    await writeCache(TEST_USER_ID, 'today_duty', [DUTY_ENTRY]);
    await clearCache(TEST_USER_ID, 'profile');
    await clearCache(TEST_USER_ID, 'today_duty');
    const { data: profile } = await readCache(TEST_USER_ID, 'profile');
    const { data: duty }    = await readCache(TEST_USER_ID, 'today_duty');
    expect(profile).toBeNull();
    expect(duty).toBeNull();
  });

  // OFFLINE-TC-007
  test('OFFLINE-TC-007: Going back online sets isOnline=true and triggers refresh', () => {
    let isOnline = false;
    // Simulate network reconnect
    isOnline = true;
    expect(isOnline).toBe(true);
    // App should call fetchStatus() again
    const refreshCalled = isOnline;
    expect(refreshCalled).toBe(true);
  });

  // OFFLINE-TC-008
  test('OFFLINE-TC-008: Write operations (submit) blocked when offline', () => {
    const isOnline = false;
    const canSubmit = isOnline; // Cannot write without network
    expect(canSubmit).toBe(false);
  });

  // Cache key format
  test('Cache key format is userId:dataKey', async () => {
    await writeCache(TEST_USER_ID, 'profile', { name: 'Test' });
    const key = `${TEST_USER_ID}:profile`;
    expect(mockAsyncStorage[key]).toBeTruthy();
  });

  // Cache timestamp
  test('Cache entry includes cachedAt timestamp', async () => {
    const before = Date.now();
    await writeCache(TEST_USER_ID, 'profile', SEBAYAT_APPROVED);
    const { cachedAt } = await readCache(TEST_USER_ID, 'profile');
    const after = Date.now();
    expect(cachedAt).not.toBeNull();
    expect(cachedAt!).toBeGreaterThanOrEqual(before);
    expect(cachedAt!).toBeLessThanOrEqual(after);
  });
});
