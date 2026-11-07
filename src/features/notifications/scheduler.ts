import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { subscribe } from '../../db/changes';
import type { Db } from '../../db/types';
import { fmtDateTime } from '../../lib/dates';
import {
  getItem,
  listAlerts,
  listItemsWithAlerts,
  setAlertNotificationIds,
  toggleTaskDone,
} from '../items/repository';
import { planAlerts } from './plan';

export const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const CATEGORY = 'item';
const ACTION_SNOOZE = 'snooze10';
const ACTION_DONE = 'done';
const CHANNEL = 'reminders';

interface Payload {
  itemId: string;
  type: string;
}

/** One-time setup: foreground behaviour, Android channel, action buttons. */
export async function configureNotifications(): Promise<void> {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Pripomienky',
      // eslint-disable-next-line import/namespace -- re-exported via `export *`
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_SNOOZE, buttonTitle: 'Odložiť 10 min', options: { opensAppToForeground: false } },
    { identifier: ACTION_DONE, buttonTitle: 'Hotovo', options: { opensAppToForeground: false } },
  ]);
}

export async function hasPermission(): Promise<boolean> {
  if (!supported) return false;
  const s = await Notifications.getPermissionsAsync();
  return s.granted;
}

export async function requestPermission(): Promise<boolean> {
  if (!supported) return false;
  const s = await Notifications.requestPermissionsAsync();
  return s.granted;
}

/** Cancels and re-schedules OS notifications for one item based on its alerts. */
export async function syncItemAlerts(db: Db, itemId: string, now = Date.now()): Promise<void> {
  if (!supported) return;
  const alerts = await listAlerts(db, itemId);
  for (const a of alerts) {
    for (const nid of a.notificationIds) await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
  }
  const item = await getItem(db, itemId);
  if (!item || !alerts.length) return;
  if (!(await hasPermission())) {
    for (const a of alerts) await setAlertNotificationIds(db, a.id, []);
    return;
  }
  const planned = planAlerts(
    item,
    alerts.map((a) => a.offsetMinutes),
    now,
  );
  for (const a of alerts) {
    const p = planned.find((x) => x.offsetMinutes === a.offsetMinutes);
    const ids: string[] = [];
    if (p) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title || 'Pripomienka',
          body: fmtDateTime(p.occurrence, item.allDay),
          data: { itemId: item.id, type: item.type } satisfies Payload,
          categoryIdentifier: CATEGORY,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: p.fireAt,
          channelId: Platform.OS === 'android' ? CHANNEL : undefined,
        },
      });
      ids.push(id);
    }
    await setAlertNotificationIds(db, a.id, ids);
  }
}

/** Re-plans everything (app start / foreground): keeps recurring alerts rolling. */
export async function rescheduleAll(db: Db): Promise<void> {
  if (!supported) return;
  const items = await listItemsWithAlerts(db);
  for (const it of items) await syncItemAlerts(db, it.id);
}

/**
 * Wires notifications to the database:
 * - item changes re-sync their alerts
 * - action buttons (snooze / done)
 * - tapping a notification opens the item
 */
export function startNotificationSync(db: Db, openItem: (id: string) => void): () => void {
  if (!supported) return () => {};
  const queue = new Set<string>();
  let running = false;
  const drain = async () => {
    if (running) return;
    running = true;
    try {
      while (queue.size) {
        const [id] = queue;
        queue.delete(id);
        await syncItemAlerts(db, id).catch((e) => console.warn('syncItemAlerts', e));
      }
    } finally {
      running = false;
    }
  };
  const unsubChanges = subscribe(({ itemIds }) => {
    for (const id of itemIds) queue.add(id);
    void drain();
  });

  const received = Notifications.addNotificationReceivedListener((n) => {
    const data = n.request.content.data as Partial<Payload> | undefined;
    if (data?.itemId) {
      queue.add(data.itemId);
      void drain();
    }
  });

  const response = Notifications.addNotificationResponseReceivedListener(async (r) => {
    const data = r.notification.request.content.data as Partial<Payload> | undefined;
    if (!data?.itemId) return;
    if (r.actionIdentifier === ACTION_SNOOZE) {
      const c = r.notification.request.content;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: c.title ?? 'Pripomienka',
          body: c.body ?? undefined,
          data: c.data,
          categoryIdentifier: CATEGORY,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 600,
          channelId: Platform.OS === 'android' ? CHANNEL : undefined,
        },
      });
    } else if (r.actionIdentifier === ACTION_DONE) {
      if (data.type === 'task') await toggleTaskDone(db, data.itemId);
    } else {
      openItem(data.itemId);
    }
    await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
  });

  return () => {
    unsubChanges();
    received.remove();
    response.remove();
  };
}

/** One-off notification with a fixed id (replaces an earlier one with the same id). */
export async function scheduleFixedNotification(id: string, at: number, title: string, body?: string): Promise<void> {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  if (at <= Date.now() || !(await hasPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: Platform.OS === 'android' ? CHANNEL : undefined,
    },
  });
}

export async function cancelFixedNotification(id: string): Promise<void> {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
