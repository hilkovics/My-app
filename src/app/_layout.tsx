import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';

import { useDb } from '@/db/hooks';
import { migrate } from '@/db/schema';
import type { Db } from '@/db/types';
import {
  configureNotifications,
  rescheduleAll,
  startNotificationSync,
} from '@/features/notifications/scheduler';

async function initDb(db: SQLiteDatabase) {
  if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db as unknown as Db);
}

/** Background wiring that needs the database: notification scheduling. */
function AppServices() {
  const db = useDb();
  useEffect(() => {
    let stop = () => {};
    void (async () => {
      await configureNotifications();
      stop = startNotificationSync(db, (id) => router.push({ pathname: '/item/[id]', params: { id } }));
      await rescheduleAll(db);
    })().catch((e) => console.warn('notifications', e));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void rescheduleAll(db).catch(() => {});
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [db]);
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName="planovac.db" onInit={initDb}>
        <AppServices />
        <Stack screenOptions={{ headerBackTitle: 'Späť' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="item/new" options={{ title: 'Nový záznam', presentation: 'modal' }} />
          <Stack.Screen name="item/[id]" options={{ title: '' }} />
          <Stack.Screen name="item/link" options={{ title: 'Prepojiť', presentation: 'modal' }} />
          <Stack.Screen name="event/notes" options={{ title: 'Poznámky' }} />
          <Stack.Screen name="external/[id]" options={{ title: 'Udalosť z telefónu' }} />
          <Stack.Screen name="habit/[id]" options={{ title: 'Návyk' }} />
          <Stack.Screen name="search" options={{ title: 'Hľadať' }} />
          <Stack.Screen name="settings" options={{ title: 'Nastavenia' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
