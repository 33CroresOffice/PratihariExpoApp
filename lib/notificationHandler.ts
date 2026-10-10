import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Router } from 'expo-router';

// Show banner + sound while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF9933',
  });
}

/** TEMP (debug only): prints the native FCM token so it can be used in Firebase Console → "Send test message". */
export async function logDeviceFcmToken() {
  if (!__DEV__ || Platform.OS !== 'android') return;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    console.log('FCM_TOKEN>>>' + t.data + '<<<');
  } catch (e) {
    console.log('FCM_TOKEN_ERROR', String(e));
  }
}

function routeFromData(router: Router, data: Record<string, unknown> | undefined) {
  const event = typeof data?.event === 'string' ? data.event : '';
  if (event.startsWith('notice')) {
    router.push('/notice');
  } else if (event.startsWith('registration') || event.startsWith('application')) {
    router.push('/application');
  } else {
    router.push('/notifications');
  }
}

/** Registers the tap listener and handles a tap that cold-started the app. Returns a cleanup fn. */
export function attachNotificationListeners(router: Router) {
  if (Platform.OS === 'web') return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    routeFromData(router, response.notification.request.content.data);
  });

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) routeFromData(router, response.notification.request.content.data);
  });

  return () => sub.remove();
}
