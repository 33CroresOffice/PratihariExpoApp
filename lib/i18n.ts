import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '@/locales/en.json';
import or from '@/locales/or.json';

export const LANGUAGE_STORAGE_KEY = 'app.language';
export type AppLanguage = 'en' | 'or';

export const SUPPORTED_LANGUAGES: { code: AppLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ' },
];

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, or: { translation: or } },
  lng: 'en',
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function loadStoredLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'or') {
      await i18n.changeLanguage(stored);
      return stored;
    }
  } catch {}
  return 'en';
}

export async function setStoredLanguage(lang: AppLanguage) {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {}
  await i18n.changeLanguage(lang);
}

const ODIA_DIGITS = ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'];

export function formatNumber(value: number | string, lang: AppLanguage): string {
  const str = String(value);
  if (lang !== 'or') return str;
  return str.replace(/[0-9]/g, (d) => ODIA_DIGITS[Number(d)]);
}

export function pickLocalized<T extends Record<string, any>>(
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

export default i18n;
