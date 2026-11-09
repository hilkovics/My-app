import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmDialogHost } from '@/components/confirm-dialog';
import { FocusWatcher } from '@/components/focus/focus-watcher';
import { ToastHost } from '@/components/toast';
import { FontFamily } from '@/constants/theme';
import { useDb } from '@/db/hooks';
import { useTheme } from '@/hooks/use-theme';
import { migrate } from '@/db/schema';
import type { Db } from '@/db/types';
import { finishDueFocus } from '@/features/focus/controller';
import { runDueTemplates } from '@/features/templates/repository';
import {
  configureNotifications,
  rescheduleAll,
  startNotificationSync,
} from '@/features/notifications/scheduler';

void SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    [FontFamily[500]]: Manrope_500Medium,
    [FontFamily[600]]: Manrope_600SemiBold,
    [FontFamily[700]]: Manrope_700Bold,
    [FontFamily[800]]: Manrope_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: theme.mark, background: theme.bg, card: theme.bg, text: theme.text, border: theme.border, notification: theme.danger },
  };
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <SQLiteProvider databaseName="planovac.db" onInit={initDb}>
          <AppServices />
          <FocusWatcher />
          <Stack
            screenOptions={{
              headerBackTitle: 'Späť',
              headerShadowVisible: false,
              headerTintColor: theme.text,
              headerStyle: { backgroundColor: theme.bg },
              headerTitleStyle: { fontFamily: FontFamily[800], fontSize: 17, color: theme.text },
              contentStyle: { backgroundColor: theme.bg },
            }}>
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
          <ToastHost />
          <ConfirmDialogHost />
        </SQLiteProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
