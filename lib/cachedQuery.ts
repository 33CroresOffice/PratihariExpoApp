import { cacheGet, cacheSet, type CacheSegment } from './offlineCache';

/**
 * Stale-while-revalidate helper:
 *  - hydrate with cached data immediately (if any)
 *  - run the live fetch when online; overwrite cache on success
 *
 * Callers pass `setData` and receive `{ cachedAt }` from the hydration step.
 */
export async function hydrateFromCache<T>(
  userId: string | null,
  segment: CacheSegment,
  setData: (data: T) => void
): Promise<{ cachedAt: number | null }> {
  if (!userId) return { cachedAt: null };
  const hit = await cacheGet<T>(userId, segment);
  if (hit) {
    setData(hit.data);
    return { cachedAt: hit.cachedAt };
  }
  return { cachedAt: null };
}

export async function writeCache<T>(
  userId: string | null,
  segment: CacheSegment,
  data: T
): Promise<void> {
  if (!userId) return;
  await cacheSet(userId, segment, data);
}
