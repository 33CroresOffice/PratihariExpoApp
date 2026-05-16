import { Platform } from 'react-native';
import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function registerPushToken(sebayatId: string) {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = await import('expo-notifications');
    const Constants = await import('expo-constants');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const projectId =
      Constants.default?.expoConfig?.extra?.eas?.projectId ??
      Constants.default?.easConfig?.projectId;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenData.data;

    const { data: pushConfig } = await supabase
      .from('notification_channels')
      .select('push_mode')
      .eq('channel', 'push')
      .maybeSingle();

    const mode = pushConfig?.push_mode ?? 'expo-go';

    await supabase.from('push_tokens').upsert(
      {
        sebayat_id: sebayatId,
        token,
        mode,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sebayat_id,token' }
    );
  } catch {
    // Push token registration is best-effort — never block the user
  }
}

export async function sendNotification(
  event: string,
  recipientSebayatId: string | null,
  templateVars: Record<string, string> = {},
  recipientType: 'sebayat' | 'admin' = 'sebayat'
) {
  try {
    await fetch(`${API_BASE}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        event,
        recipient_sebayat_id: recipientSebayatId,
        recipient_type: recipientType,
        template_vars: templateVars,
      }),
    });
  } catch {
    // Notification dispatch is best-effort
  }
}
