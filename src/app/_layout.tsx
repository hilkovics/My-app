import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';

import { useDb } from '@/db/hooks';
import { migrate } from '@/db/schema';
import type { Db } from '@/db/types';
import { finishDueFocus } from '@/features/focus/controller';
import { runDueTemplates } from '@/features/templates/repository';
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
      await finishDueFocus(db);
      await runDueTemplates(db);
    })().catch((e) => console.warn('notifications', e));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void rescheduleAll(db).catch(() => {});
        void finishDueFocus(db).catch(() => {});
        void runDueTemplates(db).catch(() => {});
      }
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
          <Stack.Screen name="plan" options={{ title: 'Plán dňa' }} />
          <Stack.Screen name="project/[id]" options={{ title: 'Projekt' }} />
          <Stack.Screen name="project/edit" options={{ title: 'Projekt' }} />
          <Stack.Screen name="goal/[id]" options={{ title: 'Cieľ' }} />
          <Stack.Screen name="goal/edit" options={{ title: 'Cieľ' }} />
          <Stack.Screen name="templates/index" options={{ title: 'Šablóny' }} />
          <Stack.Screen name="templates/edit" options={{ title: 'Šablóna' }} />
          <Stack.Screen name="activity/[id]" options={{ title: 'Aktivita' }} />
          <Stack.Screen name="activity/edit" options={{ title: 'Aktivita' }} />
          <Stack.Screen name="activity/log" options={{ title: 'Záznam', presentation: 'modal' }} />
          <Stack.Screen name="focus/pick" options={{ title: 'Na čom pracuješ', presentation: 'modal' }} />
          <Stack.Screen name="search" options={{ title: 'Hľadať' }} />
          <Stack.Screen name="settings" options={{ title: 'Nastavenia' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
