# Paste this into Bolt (one message)

Apply these exact changes to my Expo SDK 54 app. Do NOT refactor anything else, do NOT touch the `android/` folder, and do NOT remove or rename any existing code. Keep these changes in all future edits.

## 1. Install dependency
Add `"expo-file-system": "~19.0.24"` to package.json dependencies (expo-notifications `~0.32.17` and expo-constants are already there).

## 2. lib/imageCache.ts
Change the first import to the legacy entry point (SDK 54 moved the old API there):
```ts
import * as FileSystem from 'expo-file-system/legacy';
```

## 3. Create lib/notificationHandler.ts (new file, exact content)
```ts
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
```

## 4. app/_layout.tsx
a) Add this import right after `import '@/lib/i18n';`
```ts
import { attachNotificationListeners, setupNotificationChannel } from '@/lib/notificationHandler';
```
b) Inside `RootNavigator()`, immediately before the existing `useEffect` that sets `setMinTimeElapsed(true)` after 2000ms, add:
```ts
  useEffect(() => {
    setupNotificationChannel().catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    return attachNotificationListeners(router);
  }, [session]);
```

## 5. app.json (merge, keep everything already there)
- In `expo.plugins` add after `"expo-localization"`:
  `["expo-notifications", { "icon": "./assets/images/icon.png", "color": "#FFFDF9" }]`
- In `expo.android` add: `"googleServicesFile": "./android/app/google-services.json"`
- Add at `expo` level:
```json
"extra": { "router": {}, "eas": { "projectId": "55e88d37-98c8-4a8f-b86e-b1f1aa49fa92" } },
"owner": "33croresdev"
```

## 6. eas.json (new file at project root)
```json
{
  "cli": { "version": ">= 5.0.0", "appVersionSource": "local" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "android": { "buildType": "apk" } },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  },
  "submit": { "production": {} }
}
```

## 7. tsconfig.json
Add at the top level: `"exclude": ["node_modules", "supabase/functions"]`

## 8. Type fixes
- `app/(tabs)/profile.tsx`: change `profile.registration_no` to `profile?.registration_no` in the "Registration No." text.
- `app/admin-committee.tsx`: replace `.order('full_name', { nullsLast: true })` with `.order('full_name', { ascending: true, nullsFirst: false })` and the same for `first_name`.
- `app/application.tsx`: change `setApps((data as Application[]) ?? [])` to `setApps((data as unknown as Application[]) ?? [])`.
- `app/register.tsx`: change `const ins: Promise<any>[] = [];` to `const ins: PromiseLike<any>[] = [];`

## 9. Edge function supabase/functions/send-notification/index.ts
In the Push section, replace
```ts
const hasError = (providerResponse as Record<string, unknown>).errors;
pushStatus = hasError ? "failed" : "sent";
```
with
```ts
const pr = providerResponse as { errors?: unknown; data?: unknown };
const tickets = Array.isArray(pr.data) ? pr.data : pr.data ? [pr.data] : [];
const failedTicket = tickets.find((t: { status?: string }) => t?.status === "error") as
  | { message?: string }
  | undefined;
if (pr.errors || failedTicket) {
  pushStatus = "failed";
  errorMessage = failedTicket?.message ?? "Expo push request returned errors";
} else {
  pushStatus = "sent";
}
```
Then redeploy the send-notification function.
