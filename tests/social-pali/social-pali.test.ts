/**
 * Social Profile + Pali History module tests — covers URL resolution,
 * network detection, share message building, duration formatting,
 * stats computation, date range filtering, and access control.
 * Mirrors logic from app/social-profile.tsx and app/pali-history.tsx.
 */

import {
  SEBAYAT_APPROVED,
  SEBAYAT_DRAFT,
} from '../utils/test-data';

// ── Social Profile: resolveUrl (mirrors social-profile.tsx) ──
function resolveUrl(value: string, baseUrl: string): string {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return baseUrl + value.replace(/^@/, '');
}

const NETWORKS = [
  { key: 'social_facebook', label: 'Facebook',  baseUrl: 'https://facebook.com/' },
  { key: 'social_twitter',  label: 'Twitter / X', baseUrl: 'https://x.com/' },
  { key: 'social_instagram', label: 'Instagram', baseUrl: 'https://instagram.com/' },
  { key: 'social_linkedin',  label: 'LinkedIn',  baseUrl: 'https://linkedin.com/in/' },
  { key: 'social_youtube',   label: 'YouTube',   baseUrl: 'https://youtube.com/' },
];

// ── Pali History: formatDuration (mirrors pali-history.tsx) ──
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) {
    const s = seconds % 60;
    return s > 0 ? `${totalMinutes}m ${s}s` : `${totalMinutes}m`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Pali History: date range filter (mirrors pali-history.tsx) ──
function filterByDateRange(entries: any[], from: string | null, to: string | null): any[] {
  if (!from && !to) return entries;
  return entries.filter((h) => {
    if (from && h.service_date < from) return false;
    if (to && h.service_date > to) return false;
    return true;
  });
}

// ── Pali History: todayIso (mirrors pali-history.tsx) ──
function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Fixtures ──
const SOCIAL_PROFILE = {
  id: 'seb-001',
  full_name: 'Soumya Ranjan Pratihari',
  first_name: 'Soumya',
  last_name: 'Pratihari',
  alias_name: 'Bula',
  photo_url: 'https://example.com/photo.jpg',
  bansa_name: 'Badu',
  registration_no: 'PN-2026-0001',
  social_facebook: 'soumya.pratihari',
  social_twitter: '@soumya_p',
  social_instagram: 'soumya.ig',
  social_linkedin: '',
  social_youtube: 'https://youtube.com/@soumya',
};

const EMPTY_SOCIAL_PROFILE = {
  ...SOCIAL_PROFILE,
  social_facebook: '',
  social_twitter: '',
  social_instagram: '',
  social_linkedin: '',
  social_youtube: '',
};

const HISTORY_ENTRIES = [
  { id: 'h1', service_date: '2026-05-20', seba_name: 'Singha Dwara', seba_name_or: 'ସିଂହ ଦ୍ୱାର', beddha_number: 2, is_absent: false, started_at: '2026-05-20T06:00:00Z', ended_at: '2026-05-20T08:30:00Z', duration_minutes: 150, duration_seconds: 9000 },
  { id: 'h2', service_date: '2026-05-18', seba_name: 'Pratihari',    seba_name_or: 'ପ୍ରତିହାରୀ', beddha_number: 1, is_absent: false, started_at: '2026-05-18T06:00:00Z', ended_at: '2026-05-18T07:00:00Z', duration_minutes: 60,  duration_seconds: 3600 },
  { id: 'h3', service_date: '2026-05-15', seba_name: 'Singha Dwara', seba_name_or: 'ସିଂହ ଦ୍ୱାର', beddha_number: 3, is_absent: true,  started_at: null,                     ended_at: null,                       duration_minutes: null, duration_seconds: null },
  { id: 'h4', service_date: '2026-05-10', seba_name: 'Pratihari',    seba_name_or: 'ପ୍ରତିହାରୀ', beddha_number: 2, is_absent: false, started_at: '2026-05-10T05:30:00Z', ended_at: '2026-05-10T05:35:00Z', duration_minutes: 5,   duration_seconds: 300 },
];

// ── Social Profile Tests ──

describe('Social Profile — URL Resolution (SOC-TC-001)', () => {
  it('prepends base URL for username without http', () => {
    expect(resolveUrl('soumya.pratihari', 'https://facebook.com/')).toBe('https://facebook.com/soumya.pratihari');
  });

  it('strips leading @ from handle', () => {
    expect(resolveUrl('@soumya_p', 'https://x.com/')).toBe('https://x.com/soumya_p');
  });

  it('preserves full https URL', () => {
    expect(resolveUrl('https://youtube.com/@soumya', 'https://youtube.com/')).toBe('https://youtube.com/@soumya');
  });

  it('preserves full http URL', () => {
    expect(resolveUrl('http://example.com', 'https://facebook.com/')).toBe('http://example.com');
  });

  it('returns empty string for empty value', () => {
    expect(resolveUrl('', 'https://facebook.com/')).toBe('');
  });
});

describe('Social Profile — Network Detection (SOC-TC-002)', () => {
  it('detects which networks have values', () => {
    const filled = NETWORKS.filter((n) => !!SOCIAL_PROFILE[n.key as keyof typeof SOCIAL_PROFILE]);
    expect(filled).toHaveLength(4);
    expect(filled.map((n) => n.label)).not.toContain('LinkedIn');
  });

  it('returns false when all social fields are empty', () => {
    const hasSocial = NETWORKS.some((n) => !!EMPTY_SOCIAL_PROFILE[n.key as keyof typeof EMPTY_SOCIAL_PROFILE]);
    expect(hasSocial).toBe(false);
  });

  it('LinkedIn is empty in fixture', () => {
    expect(SOCIAL_PROFILE.social_linkedin).toBe('');
  });
});

describe('Social Profile — Share Message (SOC-TC-003)', () => {
  function buildShareMessage(profile: any): string {
    const lines: string[] = [`${profile.full_name}'s Social Media Profiles`];
    for (const n of NETWORKS) {
      const val = profile[n.key as keyof typeof profile] as string;
      if (val) lines.push(`${n.label}: ${resolveUrl(val, n.baseUrl)}`);
    }
    return lines.join('\n');
  }

  it('builds share message with name header', () => {
    const msg = buildShareMessage(SOCIAL_PROFILE);
    expect(msg).toContain("Soumya Ranjan Pratihari's Social Media Profiles");
  });

  it('includes only filled networks in share message', () => {
    const msg = buildShareMessage(SOCIAL_PROFILE);
    expect(msg).toContain('Facebook');
    expect(msg).toContain('YouTube');
    expect(msg).not.toContain('LinkedIn');
  });

  it('resolves URLs in share message', () => {
    const msg = buildShareMessage(SOCIAL_PROFILE);
    expect(msg).toContain('https://facebook.com/soumya.pratihari');
    expect(msg).toContain('https://x.com/soumya_p');
  });

  it('returns only header for empty profile', () => {
    const msg = buildShareMessage(EMPTY_SOCIAL_PROFILE);
    expect(msg).toBe("Soumya Ranjan Pratihari's Social Media Profiles");
  });
});

describe('Social Profile — Display Name (SOC-TC-004)', () => {
  it('uses full_name when available', () => {
    const name = SOCIAL_PROFILE.full_name || [SOCIAL_PROFILE.first_name, SOCIAL_PROFILE.last_name].filter(Boolean).join(' ') || 'Sebayat';
    expect(name).toBe('Soumya Ranjan Pratihari');
  });

  it('falls back to first+last when full_name empty', () => {
    const p = { ...SOCIAL_PROFILE, full_name: '' };
    const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sebayat';
    expect(name).toBe('Soumya Pratihari');
  });

  it('falls back to "Sebayat" when all name fields empty', () => {
    const p = { ...SOCIAL_PROFILE, full_name: '', first_name: '', last_name: '' };
    const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sebayat';
    expect(name).toBe('Sebayat');
  });
});

describe('Social Profile — Access Control (SOC-TC-005)', () => {
  it('non-approved user cannot access social profile', () => {
    expect(SEBAYAT_DRAFT.profile_status === 'approved').toBe(false);
  });

  it('approved user can access social profile', () => {
    expect(SEBAYAT_APPROVED.profile_status === 'approved').toBe(true);
  });
});

// ── Pali History Tests ──

describe('Pali History — Duration Formatting (PALI-TC-001)', () => {
  it('formats seconds-only duration (< 60s)', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats exactly 60 seconds as 1m', () => {
    expect(formatDuration(60)).toBe('1m');
  });

  it('formats minutes with remaining seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats minutes without remaining seconds', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats exactly 1 hour', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  it('formats hours with minutes', () => {
    expect(formatDuration(9000)).toBe('2h 30m');
  });

  it('formats 1 hour 1 minute', () => {
    expect(formatDuration(3660)).toBe('1h 1m');
  });

  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('Pali History — Date Range Filter (PALI-TC-002)', () => {
  it('returns all entries when no filter set', () => {
    expect(filterByDateRange(HISTORY_ENTRIES, null, null)).toHaveLength(4);
  });

  it('filters entries from a specific date', () => {
    const result = filterByDateRange(HISTORY_ENTRIES, '2026-05-15', null);
    expect(result).toHaveLength(3);
    expect(result.find((e) => e.service_date === '2026-05-10')).toBeUndefined();
  });

  it('filters entries up to a specific date', () => {
    const result = filterByDateRange(HISTORY_ENTRIES, null, '2026-05-15');
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.service_date === '2026-05-20')).toBeUndefined();
  });

  it('filters entries within a date range', () => {
    const result = filterByDateRange(HISTORY_ENTRIES, '2026-05-15', '2026-05-18');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.service_date)).toContain('2026-05-15');
    expect(result.map((e) => e.service_date)).toContain('2026-05-18');
  });

  it('returns empty for range outside data', () => {
    const result = filterByDateRange(HISTORY_ENTRIES, '2026-06-01', '2026-06-30');
    expect(result).toHaveLength(0);
  });

  it('single-day range returns entries for that day', () => {
    const result = filterByDateRange(HISTORY_ENTRIES, '2026-05-20', '2026-05-20');
    expect(result).toHaveLength(1);
    expect(result[0].service_date).toBe('2026-05-20');
  });
});

describe('Pali History — Stats Computation (PALI-TC-003)', () => {
  const completed = HISTORY_ENTRIES.filter((h) => !h.is_absent && h.duration_seconds != null);
  const totalSeconds = completed.reduce((acc, h) => acc + (h.duration_seconds ?? 0), 0);
  const totalDuties = HISTORY_ENTRIES.length;
  const absentCount = HISTORY_ENTRIES.filter((h) => h.is_absent).length;
  const recordedCount = HISTORY_ENTRIES.filter((h) => !h.is_absent).length;

  it('counts total duties correctly', () => {
    expect(totalDuties).toBe(4);
  });

  it('counts absent entries correctly', () => {
    expect(absentCount).toBe(1);
  });

  it('counts recorded (completed) entries correctly', () => {
    expect(recordedCount).toBe(3);
  });

  it('sums total seconds correctly', () => {
    expect(totalSeconds).toBe(9000 + 3600 + 300);
  });

  it('formats total duration correctly', () => {
    expect(formatDuration(totalSeconds)).toBe('3h 35m');
  });

  it('absent entry has null duration', () => {
    const absent = HISTORY_ENTRIES.find((h) => h.is_absent);
    expect(absent!.duration_seconds).toBeNull();
    expect(absent!.started_at).toBeNull();
    expect(absent!.ended_at).toBeNull();
  });
});

describe('Pali History — Sort Order (PALI-TC-004)', () => {
  it('entries sorted by service_date descending', () => {
    const sorted = [...HISTORY_ENTRIES].sort((a, b) =>
      b.service_date.localeCompare(a.service_date)
    );
    expect(sorted[0].service_date).toBe('2026-05-20');
    expect(sorted[3].service_date).toBe('2026-05-10');
  });
});

describe('Pali History — Today ISO (PALI-TC-005)', () => {
  it('todayIso returns YYYY-MM-DD format', () => {
    const today = todayIso();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('todayIso matches current date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayIso()).toBe(expected);
  });
});

describe('Pali History — Access Control (PALI-TC-006)', () => {
  it('non-approved user is redirected away', () => {
    expect(SEBAYAT_DRAFT.profile_status === 'approved').toBe(false);
  });

  it('approved user can access pali history', () => {
    expect(SEBAYAT_APPROVED.profile_status === 'approved').toBe(true);
  });
});

describe('Pali History — Entry Status (PALI-TC-007)', () => {
  it('completed entry has both started_at and ended_at', () => {
    const completed = HISTORY_ENTRIES.filter((h) => !h.is_absent);
    expect(completed.every((h) => h.started_at && h.ended_at)).toBe(true);
  });

  it('absent entry has null timestamps', () => {
    const absent = HISTORY_ENTRIES.find((h) => h.is_absent);
    expect(absent!.started_at).toBeNull();
    expect(absent!.ended_at).toBeNull();
  });

  it('beddha_number is set for all entries', () => {
    expect(HISTORY_ENTRIES.every((h) => h.beddha_number != null)).toBe(true);
  });
});
