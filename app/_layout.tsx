import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  NotoSansOriya_400Regular,
  NotoSansOriya_600SemiBold,
  NotoSansOriya_700Bold,
} from '@expo-google-fonts/noto-sans-oriya';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import SplashScreenView from '@/components/SplashScreenView';
import '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth/phone');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (!splashDone) {
    return (
      <SplashScreenView
        shouldHide={!loading && minTimeElapsed}
        onFinished={() => setSplashDone(true)}
      />
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/phone" />
        <Stack.Screen name="auth/verify" />
        <Stack.Screen name="register" />
        <Stack.Screen name="notice" />
        <Stack.Screen name="committee" />
        <Stack.Screen name="application" />
        <Stack.Screen name="pali-history" />
        <Stack.Screen name="social-profile" />
        <Stack.Screen name="admin-notices" />
        <Stack.Screen name="admin-committee" />
        <Stack.Screen name="admin-event-images" />
        <Stack.Screen name="admin-seba-categories" />
        <Stack.Screen name="admin-seba-history" />
        <Stack.Screen name="sebayat/[id]" />
        <Stack.Screen name="members/[group]" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    NotoSansOriya_400Regular,
    NotoSansOriya_600SemiBold,
    NotoSansOriya_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <OfflineProvider>
            <RootNavigator />
          </OfflineProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
