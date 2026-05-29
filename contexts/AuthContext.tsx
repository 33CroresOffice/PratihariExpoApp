import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/lib/pushNotifications';

const API_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type ProfileStatus = 'none' | 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested' | 'resubmitted';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileStatus: ProfileStatus;
  profileStatusLoading: boolean;
}

interface AuthContextType extends AuthState {
  sendOtp: (phone: string, channel?: 'sms' | 'whatsapp') => Promise<{ success: boolean; error?: string; testOtp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  resendOtp: (phone: string, channel?: 'sms' | 'voice') => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfileStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    profileStatus: 'none',
    profileStatusLoading: false,
  });

  async function fetchProfileStatus(userId: string) {
    setState((prev) => ({ ...prev, profileStatusLoading: true }));
    const { data } = await supabase
      .from('sebayats')
      .select('profile_status')
      .eq('auth_user_id', userId)
      .maybeSingle();
    setState((prev) => ({
      ...prev,
      profileStatus: (data?.profile_status as ProfileStatus) ?? 'none',
      profileStatusLoading: false,
    }));
  }

  async function refreshProfileStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await fetchProfileStatus(session.user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setState((prev) => ({ ...prev, user, session, loading: false }));
      if (user) fetchProfileStatus(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState((prev) => ({ ...prev, user, session }));
      if (user) fetchProfileStatus(user.id);
      else setState((prev) => ({ ...prev, profileStatus: 'none' }));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function sendOtp(phone: string, channel: 'sms' | 'whatsapp' = 'sms') {
    try {
      const response = await fetch(`${API_BASE}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ phone, channel }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send OTP' };
      }
      return { success: true, testOtp: data.test_otp };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async function verifyOtp(phone: string, otp: string) {
    try {
      const response = await fetch(`${API_BASE}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Verification failed' };
      }

      // Seed profileStatus immediately from the response before setSession triggers
      // onAuthStateChange — this avoids the race condition where fetchProfileStatus
      // runs before the DB write (auth_user_id linking) has propagated.
      if (data.profile_status) {
        setState((prev) => ({ ...prev, profileStatus: data.profile_status as ProfileStatus }));
      }

      // Set the session from the returned tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        return { success: false, error: 'Failed to establish session' };
      }

      // Register push token best-effort after session is established
      if (data.sebayat_id) {
        (async () => {
          await registerPushToken(data.sebayat_id);
        })();
      }

      return { success: true, isNewUser: data.is_new_user };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async function resendOtp(phone: string, channel: 'sms' | 'voice' = 'sms') {
    try {
      const response = await fetch(`${API_BASE}/functions/v1/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ phone, channel }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to resend OTP' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false });
  }

  return (
    <AuthContext.Provider value={{ ...state, sendOtp, verifyOtp, resendOtp, signOut, refreshProfileStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

const noopAuth: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  profileStatus: 'none',
  profileStatusLoading: false,
  sendOtp: async () => ({ success: false, error: 'Auth not ready' }),
  verifyOtp: async () => ({ success: false, error: 'Auth not ready' }),
  resendOtp: async () => ({ success: false, error: 'Auth not ready' }),
  signOut: async () => {},
  refreshProfileStatus: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? noopAuth;
}
