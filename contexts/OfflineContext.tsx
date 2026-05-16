import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getOfflinePref, setOfflinePref, clearUserCache, getLastUserId, setLastUserId } from '@/lib/offlineCache';
import { clearImageCache } from '@/lib/imageCache';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface OfflineContextType {
  isOnline: boolean;
  offlineEnabled: boolean;
  setOfflineEnabled: (v: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  currentUserId: string | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useNetworkStatus();
  const { user } = useAuth();
  const [offlineEnabled, setOfflineEnabledState] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const pref = await getOfflinePref();
      setOfflineEnabledState(pref);
    })();
  }, []);

  // Handle account switching and sync pref from server
  useEffect(() => {
    if (!user) {
      setCurrentUserId(null);
      return;
    }
    (async () => {
      const prev = await getLastUserId();
      if (prev && prev !== user.id) {
        await clearUserCache(prev);
      }
      await setLastUserId(user.id);
      setCurrentUserId(user.id);

      if (isOnline) {
        const { data } = await supabase
          .from('sebayats')
          .select('offline_mode_enabled')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (data && typeof data.offline_mode_enabled === 'boolean') {
          await setOfflinePref(data.offline_mode_enabled);
          setOfflineEnabledState(data.offline_mode_enabled);
        }
      }
    })();
  }, [user, isOnline]);

  const setOfflineEnabled = useCallback(async (v: boolean) => {
    await setOfflinePref(v);
    setOfflineEnabledState(v);
    if (user && isOnline) {
      await supabase
        .from('sebayats')
        .update({ offline_mode_enabled: v })
        .eq('auth_user_id', user.id);
    }
    if (!v && user) {
      await clearUserCache(user.id);
      await clearImageCache();
    }
  }, [user, isOnline]);

  const clearCache = useCallback(async () => {
    if (user) await clearUserCache(user.id);
    await clearImageCache();
  }, [user]);

  return (
    <OfflineContext.Provider value={{ isOnline, offlineEnabled, setOfflineEnabled, clearCache, currentUserId }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextType {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    return {
      isOnline: true,
      offlineEnabled: true,
      setOfflineEnabled: async () => {},
      clearCache: async () => {},
      currentUserId: null,
    };
  }
  return ctx;
}
