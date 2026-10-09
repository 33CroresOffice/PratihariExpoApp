import { useEffect, useRef, useState } from 'react';
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
import {
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VersionCheck from 'react-native-version-check';

import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import SplashScreenView from '@/components/SplashScreenView';
import '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

const ANDROID_PACKAGE_NAME = 'com.x33croresdev.pratihari';
const PLAY_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.x33croresdev.pratihari';
const PLAY_STORE_APP_URL = `market://details?id=${ANDROID_PACKAGE_NAME}`;

type UpdateModalData = {
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
};

function usePlayStoreUpdateCheck() {
  const [updateData, setUpdateData] = useState<UpdateModalData | null>(null);
  const checkingRef = useRef(false);

  const checkUpdate = async () => {
    if (Platform.OS !== 'android') return;
    if (checkingRef.current) return;

    checkingRef.current = true;

    try {
      const currentVersion = VersionCheck.getCurrentVersion();
      // const currentVersion = '1.0.0'; // TODO: Replace with actual version

      const latestVersion = await VersionCheck.getLatestVersion({
        provider: 'playStore',
        packageName: ANDROID_PACKAGE_NAME,
        ignoreErrors: true,
      });

      if (!latestVersion || typeof latestVersion !== 'string') {
        checkingRef.current = false;
        return;
      }

      const result = await VersionCheck.needUpdate({
        currentVersion,
        latestVersion,
        depth: 3,
      });

      if (result?.isNeeded) {
        setUpdateData({
          currentVersion: result.currentVersion || currentVersion,
          latestVersion: result.latestVersion || latestVersion,
          storeUrl: PLAY_STORE_WEB_URL,
        });
      }
    } catch (error) {
      console.log('Version check failed:', error);
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    checkUpdate();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkUpdate();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  return updateData;
}

function ForceUpdateModal({
  updateData,
}: {
  updateData: UpdateModalData | null;
}) {
  if (!updateData) return null;

  const openPlayStore = async () => {
    try {
      await Linking.openURL(PLAY_STORE_APP_URL);
    } catch {
      await Linking.openURL(updateData.storeUrl);
    }
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => { }}
    >
      <View style={styles.updateOverlay}>
        <View style={styles.updateCard}>
          <View style={styles.updateIconBox}>
            <Text style={styles.updateIcon}>↻</Text>
          </View>

          <Text style={styles.updateTitle}>Update Required</Text>

          <Text style={styles.updateMessage}>
            A new version of Pratihari app is available on Play Store. Please
            update the app to continue.
          </Text>

          <View style={styles.versionBox}>
            <Text style={styles.versionText}>
              Current Version: {updateData.currentVersion}
            </Text>
            <Text style={styles.versionText}>
              Latest Version: {updateData.latestVersion}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.updateButton}
            onPress={openPlayStore}
          >
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function RootNavigator() {
  const { session, loading, suspended } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const updateData = usePlayStoreUpdateCheck();

  const [splashDone, setSplashDone] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const onSuspendedScreen = segments[0] === 'suspended';

    if (suspended && !onSuspendedScreen) {
      router.replace('/suspended');
    } else if (!session && !inAuthGroup && !onSuspendedScreen) {
      router.replace('/auth/phone');
    } else if (session && inAuthGroup && !suspended) {
      router.replace('/(tabs)');
    } else if (session && onSuspendedScreen && !suspended) {
      router.replace('/(tabs)');
    }
  }, [session, loading, suspended, segments]);

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
        <Stack.Screen name="admin-sahis" />
        <Stack.Screen name="sebayat/[id]" />
        <Stack.Screen name="members/[group]" />
        <Stack.Screen name="suspended" />
        <Stack.Screen name="+not-found" />
      </Stack>

      <StatusBar style="dark" />

      <ForceUpdateModal updateData={updateData} />
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

const styles = StyleSheet.create({
  updateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },

  updateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
  },

  updateIconBox: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  updateIcon: {
    fontSize: 38,
    fontWeight: '800',
    color: '#EA580C',
  },

  updateTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },

  updateMessage: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },

  versionBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },

  versionText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#374151',
    marginBottom: 4,
  },

  updateButton: {
    width: '100%',
    backgroundColor: '#EA580C',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  updateButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
  },
});