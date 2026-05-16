import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import {
  AppLanguage,
  loadStoredLanguage,
  setStoredLanguage,
  formatNumber as fmtNumber,
} from '@/lib/i18n';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  ready: boolean;
  t: (key: string, options?: any) => string;
  formatNumber: (value: number | string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [ready, setReady] = useState(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    (async () => {
      const lang = await loadStoredLanguage();
      setLanguageState(lang);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (!session?.user) return;
        try {
          const { data } = await supabase
            .from('sebayats')
            .select('preferred_language')
            .eq('auth_user_id', session.user.id)
            .maybeSingle();
          const pref = data?.preferred_language as AppLanguage | undefined;
          if (pref && (pref === 'en' || pref === 'or') && pref !== i18n.language) {
            await setStoredLanguage(pref);
            setLanguageState(pref);
          } else if (!pref && i18n.language) {
            await supabase
              .from('sebayats')
              .update({ preferred_language: i18n.language })
              .eq('auth_user_id', session.user.id);
          }
        } catch {}
      })();
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, [i18n.language]);

  async function setLanguage(lang: AppLanguage) {
    await setStoredLanguage(lang);
    setLanguageState(lang);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('sebayats')
          .update({ preferred_language: lang })
          .eq('auth_user_id', user.id);
      }
    } catch {}
  }

  const value: LanguageContextValue = {
    language,
    setLanguage,
    ready,
    t: t as any,
    formatNumber: (v) => fmtNumber(v, language),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
