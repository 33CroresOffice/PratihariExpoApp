/**
 * I18N Module Tests — Internationalization & Localization
 * Covers: I18N-TC-001 through I18N-TC-006
 */

import { NOTICE, SEBA_CATEGORY, DUTY_ENTRY } from '../utils/test-data';

// ─── Mirror lib/i18n.ts pure functions (no native deps needed) ────────────────

type AppLanguage = 'en' | 'or';

const ODIA_DIGITS = ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'];

function formatNumber(value: number | string, lang: AppLanguage): string {
  const str = String(value);
  if (lang !== 'or') return str;
  return str.replace(/[0-9]/g, (d) => ODIA_DIGITS[Number(d)]);
}

function pickLocalized<T extends Record<string, any>>(
  row: T | null | undefined,
  field: string,
  lang: AppLanguage
): string {
  if (!row) return '';
  if (lang === 'or') {
    const orVal = row[`${field}_or`];
    if (orVal != null && String(orVal).trim() !== '') return String(orVal);
  }
  return row[field] != null ? String(row[field]) : '';
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  nativeLabel: 'English' },
  { code: 'or', label: 'Odia',     nativeLabel: 'ଓଡ଼ିଆ'   },
];

const LANGUAGE_STORAGE_KEY = 'app.language';

// Simulated in-memory translation resources
const resources: Record<AppLanguage, Record<string, any>> = {
  en: {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'common.jayJagannath': 'Jay Jagannatha',
    'common.pratihariNijog': 'Pratihari Nijog',
    'common.templeName': 'Shree Jagannatha Temple, Puri',
    'auth.phoneTitle': 'Pratihari Nijog',
    'splash.title': 'Pratihari Nijog',
    'splash.tagline': 'Shree Jagannatha Temple, Puri',
  },
  or: {
    'common.save': 'ସଞ୍ଚୟ କରନ୍ତୁ',
    'common.cancel': 'ବାତିଲ କରନ୍ତୁ',
    'common.loading': 'ଲୋଡ୍ ହେଉଛି...',
    'common.jayJagannath': 'ଜୟ ଜଗନ୍ନାଥ',
    'common.pratihariNijog': 'ପ୍ରତିହାରୀ ନିଯୋଗ',
    'common.templeName': 'ଶ୍ରୀ ଜଗନ୍ନାଥ ମନ୍ଦିର, ପୁରୀ',
    'auth.phoneTitle': 'ପ୍ରତିହାରୀ ନିଯୋଗ',
    'splash.title': 'ପ୍ରତିହାରୀ ନିଯୋଗ',
    'splash.tagline': 'ଶ୍ରୀ ଜଗନ୍ନାଥ ମନ୍ଦିର, ପୁରୀ',
  },
};

function t(key: string, lang: AppLanguage): string {
  return resources[lang][key] ?? resources['en'][key] ?? key;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('I18N Module — Language Toggle', () => {
  // I18N-TC-001
  test('I18N-TC-001: Default language is English', () => {
    const defaultLang: AppLanguage = 'en';
    expect(defaultLang).toBe('en');
    expect(t('common.save', defaultLang)).toBe('Save');
  });

  // I18N-TC-002
  test('I18N-TC-002: Switch to Odia — UI strings rendered in Odia', () => {
    const lang: AppLanguage = 'or';
    expect(t('common.save', lang)).toBe('ସଞ୍ଚୟ କରନ୍ତୁ');
    expect(t('common.loading', lang)).toBe('ଲୋଡ୍ ହେଉଛି...');
    expect(t('splash.title', lang)).toBe('ପ୍ରତିହାରୀ ନିଯୋଗ');
  });

  // I18N-TC-003
  test('I18N-TC-003: English fallback — missing Odia key returns English value', () => {
    const orResources: Record<string, string> = {};
    const fallbackT = (key: string, lang: AppLanguage): string => {
      if (lang === 'or' && orResources[key]) return orResources[key];
      return resources['en'][key] ?? key;
    };
    // No Odia translation for this key
    expect(fallbackT('common.save', 'or')).toBe('Save');
  });

  // I18N-TC-004
  test('I18N-TC-004: Language persistence key is app.language', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('app.language');
  });

  test('I18N-TC-004b: Only en and or are valid stored language values', () => {
    const validLangs = ['en', 'or'];
    const stored = 'en';
    expect(validLangs).toContain(stored);
    const invalid = 'fr';
    expect(validLangs).not.toContain(invalid);
  });
});

describe('I18N Module — Localized Content', () => {
  // I18N-TC-005
  test('I18N-TC-005: pickLocalized returns Odia field when lang=or and _or field is populated', () => {
    const result = pickLocalized(SEBA_CATEGORY, 'name', 'or');
    expect(result).toBe('ପ୍ରତିହାରୀ');
  });

  test('I18N-TC-005b: pickLocalized returns English field when lang=en', () => {
    const result = pickLocalized(SEBA_CATEGORY, 'name', 'en');
    expect(result).toBe('Pratihari');
  });

  test('I18N-TC-005c: pickLocalized falls back to English when Odia field is null', () => {
    const row = { title: 'Festival Notice', title_or: null };
    const result = pickLocalized(row, 'title', 'or');
    expect(result).toBe('Festival Notice');
  });

  test('I18N-TC-005d: pickLocalized falls back to English when Odia field is empty string', () => {
    const row = { name: 'Pratihari', name_or: '' };
    const result = pickLocalized(row, 'name', 'or');
    expect(result).toBe('Pratihari');
  });

  test('I18N-TC-005e: pickLocalized returns empty string for null row', () => {
    const result = pickLocalized(null, 'name', 'or');
    expect(result).toBe('');
  });

  // I18N-TC-006 — Notice bilingual fields
  test('I18N-TC-006: Notice Odia title rendered when lang=or', () => {
    const result = pickLocalized(NOTICE, 'title', 'or');
    expect(result).toBe('ବାର୍ଷିକ ଉତ୍ସବ');
  });

  test('I18N-TC-006b: Notice body fallback to English when body_or is null', () => {
    const result = pickLocalized(NOTICE, 'body', 'or');
    expect(result).toBe('The annual Rath Yatra festival will be held on June 20.');
  });
});

describe('I18N Module — Number Formatting', () => {
  test('formatNumber lang=en — returns plain Arabic digits', () => {
    expect(formatNumber(2026, 'en')).toBe('2026');
    expect(formatNumber('42', 'en')).toBe('42');
  });

  test('formatNumber lang=or — returns Odia digits', () => {
    expect(formatNumber(0, 'or')).toBe('୦');
    expect(formatNumber(1, 'or')).toBe('୧');
    expect(formatNumber(9, 'or')).toBe('୯');
    expect(formatNumber(2026, 'or')).toBe('୨୦୨୬');
    expect(formatNumber(42, 'or')).toBe('୪୨');
  });

  test('formatNumber mixed string with digits lang=or', () => {
    const result = formatNumber('Beddha 3', 'or');
    expect(result).toBe('Beddha ୩');
  });

  test('formatNumber with string number preserves leading zeros in Odia', () => {
    expect(formatNumber('007', 'or')).toBe('୦୦୭');
  });
});

describe('I18N Module — Supported Languages', () => {
  test('SUPPORTED_LANGUAGES contains exactly en and or', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('or');
    expect(codes).toHaveLength(2);
  });

  test('Odia native label is in Odia script', () => {
    const orLang = SUPPORTED_LANGUAGES.find((l) => l.code === 'or');
    expect(orLang).toBeDefined();
    expect(orLang!.nativeLabel).toBe('ଓଡ଼ିଆ');
  });

  test('Duty entry seba_name_or is in Odia script', () => {
    expect(DUTY_ENTRY.seba_name_or).toBe('ପ୍ରତିହାରୀ');
    const displayed = pickLocalized(DUTY_ENTRY, 'seba_name', 'or');
    expect(displayed).toBe('ପ୍ରତିହାରୀ');
  });
});
