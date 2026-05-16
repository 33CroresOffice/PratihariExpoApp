import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_VERSION = 1;
const KEY_PREFIX = 'pn_cache_v' + CACHE_VERSION;
const PREF_KEY = 'pn_offline_pref';
const LAST_USER_KEY = 'pn_last_user';

export type CacheSegment =
  | 'profile'
  | 'identity_docs'
  | 'nijog_assignments'
  | 'seba_selections'
  | 'today_duty'
  | 'today_beddha'
  | 'next_duty'
  | 'schedule_5yr'
  | 'pali_history'
  | 'committee'
  | 'notices'
  | 'notice_reads'
  | 'unread_notice_count'
  | 'pending_app_count'
  | 'group_counts'
  | 'active_sessions'
  | 'user_groups';

interface Envelope<T> {
  data: T;
  cachedAt: number;
}

function keyFor(userId: string, segment: CacheSegment) {
  return `${KEY_PREFIX}:${userId}:${segment}`;
}

export async function cacheGet<T>(userId: string, segment: CacheSegment): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, segment));
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    return { data: env.data, cachedAt: env.cachedAt };
  } catch {
    return null;
  }
}

export async function cacheSet<T>(userId: string, segment: CacheSegment, data: T): Promise<void> {
  try {
    const env: Envelope<T> = { data, cachedAt: Date.now() };
    await AsyncStorage.setItem(keyFor(userId, segment), JSON.stringify(env));
  } catch {
    // silent: cache failure should never break the app
  }
}

export async function clearUserCache(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `${KEY_PREFIX}:${userId}:`;
    const toDel = keys.filter((k) => k.startsWith(prefix));
    if (toDel.length > 0) await AsyncStorage.multiRemove(toDel);
  } catch {
    // silent
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toDel = keys.filter((k) => k.startsWith(KEY_PREFIX + ':'));
    if (toDel.length > 0) await AsyncStorage.multiRemove(toDel);
  } catch {
    // silent
  }
}

export async function getLastUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export async function setLastUserId(userId: string | null): Promise<void> {
  try {
    if (userId) await AsyncStorage.setItem(LAST_USER_KEY, userId);
    else await AsyncStorage.removeItem(LAST_USER_KEY);
  } catch {
    // silent
  }
}

export async function getOfflinePref(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

export async function setOfflinePref(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, enabled ? '1' : '0');
  } catch {
    // silent
  }
}

export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
