import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const DIR = FileSystem.cacheDirectory + 'pn_images/';
const INDEX_KEY = DIR + '_index.json';
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap

interface IndexEntry {
  file: string;    // filename inside DIR
  url: string;
  size: number;    // bytes
  accessedAt: number;
}

type Index = Record<string, IndexEntry>; // keyed by url hash

// Simple djb2 hash that produces a safe filename
function hashUrl(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = (h * 33) ^ url.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

async function readIndex(): Promise<Index> {
  try {
    const raw = await FileSystem.readAsStringAsync(INDEX_KEY);
    return JSON.parse(raw) as Index;
  } catch {
    return {};
  }
}

async function writeIndex(index: Index): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(INDEX_KEY, JSON.stringify(index));
  } catch {
    // silent
  }
}

async function evictLRU(index: Index, neededBytes: number): Promise<Index> {
  const entries = Object.values(index).sort((a, b) => a.accessedAt - b.accessedAt);
  let totalBytes = entries.reduce((s, e) => s + e.size, 0);
  const updated = { ...index };

  for (const entry of entries) {
    if (totalBytes + neededBytes <= MAX_BYTES) break;
    try {
      await FileSystem.deleteAsync(DIR + entry.file, { idempotent: true });
    } catch {
      // silent
    }
    totalBytes -= entry.size;
    delete updated[hashUrl(entry.url)];
  }
  return updated;
}

/**
 * Returns a local file:// URI for the given remote URL, downloading it if necessary.
 * Returns null on any failure (caller should fall back to remote URL).
 * No-op on web (returns the original URL directly).
 */
export async function getCachedImageUri(remoteUrl: string | null | undefined): Promise<string | null> {
  if (!remoteUrl) return null;
  if (Platform.OS === 'web') return remoteUrl;

  try {
    await ensureDir();
    const key = hashUrl(remoteUrl);
    const index = await readIndex();
    const entry = index[key];

    if (entry) {
      const info = await FileSystem.getInfoAsync(DIR + entry.file);
      if (info.exists) {
        // Touch accessedAt for LRU
        index[key] = { ...entry, accessedAt: Date.now() };
        await writeIndex(index);
        return DIR + entry.file;
      }
      // File gone — remove stale index entry and re-download
      delete index[key];
    }

    // Download
    const ext = remoteUrl.split('?')[0].split('.').pop()?.slice(0, 5) ?? 'img';
    const filename = `${key}.${ext}`;
    const destUri = DIR + filename;

    const result = await FileSystem.downloadAsync(remoteUrl, destUri);
    const fileInfo = await FileSystem.getInfoAsync(destUri);
    const size = (fileInfo as any).size ?? 0;

    // Evict LRU if needed before adding
    const evicted = await evictLRU(index, size);
    evicted[key] = { file: filename, url: remoteUrl, size, accessedAt: Date.now() };
    await writeIndex(evicted);

    return result.uri;
  } catch {
    return null;
  }
}

/**
 * Warms the cache for a list of URLs in the background. Errors are silently swallowed.
 */
export async function prewarmImages(urls: (string | null | undefined)[]): Promise<void> {
  if (Platform.OS === 'web') return;
  for (const url of urls) {
    if (url) getCachedImageUri(url).catch(() => {});
  }
}

/**
 * Deletes all cached images for the current user.
 */
export async function clearImageCache(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch {
    // silent
  }
}
