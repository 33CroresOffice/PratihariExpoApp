import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEDULED_KEY = 'offline_beddha_reminders_scheduled';
const ENABLED_KEY = 'offline_beddha_reminders_enabled';

type CachedDuty = {
  service_date: string;
  seba_name: string;
  seba_name_or: string | null;
  beddha_number: number;
  is_nijog: boolean;
};

type ScheduledReminder = {
  dutyDate: string;
  stage: '5day' | '3day' | '1day' | 'dayof';
  notificationId: string;
};

const REMINDER_STAGES = [
  { stage: '5day' as const, offsetDays: 5, hour: 20, minute: 0 },
  { stage: '3day' as const, offsetDays: 3, hour: 20, minute: 0 },
  { stage: '1day' as const, offsetDays: 1, hour: 20, minute: 0 },
  { stage: 'dayof' as const, offsetDays: 0, hour: 4, minute: 0 },
];

export async function isOfflineRemindersEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ENABLED_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

export async function setOfflineRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await cancelAllOfflineReminders();
  }
}

function getReminderDate(dutyDate: string, offsetDays: number, hour: number, minute: number): Date {
  const d = new Date(dutyDate + 'T00:00:00');
  d.setDate(d.getDate() - offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export async function scheduleOfflineReminders(duties: CachedDuty[]): Promise<void> {
  if (Platform.OS === 'web') return;

  const enabled = await isOfflineRemindersEnabled();
  if (!enabled) return;

  try {
    const Notifications = await import('expo-notifications');

    // Cancel all previously scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const scheduled: ScheduledReminder[] = [];

    for (const duty of duties) {
      // Only schedule for duties within the next 30 days
      const dutyDate = new Date(duty.service_date + 'T00:00:00');
      const daysUntilDuty = Math.floor((dutyDate.getTime() - now.getTime()) / 86400000);
      if (daysUntilDuty > 30 || daysUntilDuty < 0) continue;

      for (const stage of REMINDER_STAGES) {
        const reminderDate = getReminderDate(duty.service_date, stage.offsetDays, stage.hour, stage.minute);

        // Only schedule if the reminder time is in the future
        if (reminderDate <= now) continue;

        const sebaName = duty.seba_name;
        const beddhaNum = String(duty.beddha_number);
        const dateLabel = new Date(duty.service_date + 'T00:00:00').toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

        const stageLabel =
          stage.stage === '5day' ? 'in 5 days'
          : stage.stage === '3day' ? 'in 3 days'
          : stage.stage === '1day' ? 'tomorrow'
          : 'today';

        const title = `Seba ${stageLabel}`;
        const body = `${sebaName} on ${dateLabel} | Beddha #${beddhaNum}`;

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
            data: {
              type: 'seba_reminder',
              dutyDate: duty.service_date,
              stage: stage.stage,
            },
          },
          trigger: {
            date: reminderDate,
            channelId: 'seba-reminders',
          },
        });

        scheduled.push({
          dutyDate: duty.service_date,
          stage: stage.stage,
          notificationId,
        });
      }
    }

    // Store the scheduled IDs so we can deduplicate on future syncs
    await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduled));
  } catch {
    // Best-effort — don't block the app
  }
}

export async function cancelAllOfflineReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(SCHEDULED_KEY);
  } catch {
    // Best-effort
  }
}

export async function getScheduledReminderCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as ScheduledReminder[];
    return parsed.length;
  } catch {
    return 0;
  }
}

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'ios') return;

  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setNotificationChannelAsync('seba-reminders', {
      name: 'Seba Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      enableLights: true,
    });
  } catch {
    // Best-effort
  }
}
