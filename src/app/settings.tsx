import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Row, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { exportBackup, importBackup, toIcs } from '@/features/backup/backup';
import {
  deviceCalendarSupported,
  hasCalendarPermission,
  listDeviceCalendars,
  requestCalendarPermission,
  type DeviceCalendar,
} from '@/features/calendar/device';
import { listAllItems } from '@/features/items/repository';
import { fmtMinutes } from '@/features/focus/stats';
import { ALERT_PRESETS, describeOffset } from '@/features/notifications/plan';
import {
  hasPermission,
  requestPermission,
  rescheduleAll,
  supported as notificationsSupported,
} from '@/features/notifications/scheduler';
import { getSettings, setSetting } from '@/features/settings/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm, notify } from '@/lib/confirm';
import { ymd } from '@/lib/dates';

export default function SettingsScreen() {
  const db = useDb();
  const theme = useTheme();
  const settings = useLiveQuery((d) => getSettings(d), []);
  const [notifOk, setNotifOk] = useState<boolean | null>(null);
  const [calOk, setCalOk] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);

  useEffect(() => {
    void hasPermission().then(setNotifOk);
    void hasCalendarPermission().then(async (ok) => {
      setCalOk(ok);
      if (ok) setCalendars(await listDeviceCalendars());
    });
  }, []);

  const allowCalendars = async () => {
    const ok = await requestCalendarPermission();
    setCalOk(ok);
    if (ok) {
      const list = await listDeviceCalendars();
      setCalendars(list);
      if (settings && !settings.deviceCalendarIds.length) await setSetting(db, 'deviceCalendarIds', list.map((c) => c.id));
    }
  };

  const toggleCalendar = (id: string, on: boolean) => {
    if (!settings) return;
    const ids = on ? [...settings.deviceCalendarIds, id] : settings.deviceCalendarIds.filter((x) => x !== id);
    void setSetting(db, 'deviceCalendarIds', [...new Set(ids)]);
  };

  const shareText = async (name: string, content: string, mime: string) => {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(content);
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
  };

  const exportJson = async () => {
    const data = await exportBackup(db);
    await shareText(`planovac-${ymd(Date.now())}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const exportIcs = async () => {
    await shareText(`planovac-${ymd(Date.now())}.ics`, toIcs(await listAllItems(db)), 'text/calendar');
  };

  const importJson = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    if (!(await confirm(t.settings.importJson, t.settings.importConfirm, 'Obnoviť'))) return;
    try {
      const asset = res.assets[0];
      const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      await importBackup(db, JSON.parse(text));
      await rescheduleAll(db);
      notify(t.settings.imported);
    } catch (e) {
      notify('Chyba', e instanceof Error ? e.message : String(e));
    }
  };

  if (!settings) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Section title={t.settings.notifications}>
        <Card>
          {notificationsSupported ? (
            <Row style={styles.between}>
              <ThemedText>{notifOk ? t.settings.notificationsOn : t.settings.notificationsOff}</ThemedText>
              {!notifOk ? (
                <Button
                  small
                  label={t.settings.allow}
                  onPress={() =>
                    void requestPermission().then(async (ok) => {
                      setNotifOk(ok);
                      if (ok) await rescheduleAll(db);
                    })
                  }
                />
              ) : null}
            </Row>
          ) : (
            <ThemedText themeColor="text2">{t.settings.notSupported}</ThemedText>
          )}
          <ThemedText type="small" themeColor="text2">
            {t.settings.defaultAlert}
          </ThemedText>
          <Row>
            <Chip label={t.common.none} selected={!settings.defaultAlerts.length} onPress={() => void setSetting(db, 'defaultAlerts', [])} />
            {ALERT_PRESETS.slice(0, 7).map((o) => (
              <Chip
                key={o}
                label={describeOffset(o)}
                selected={settings.defaultAlerts.includes(o)}
                onPress={() => void setSetting(db, 'defaultAlerts', [o])}
              />
            ))}
          </Row>
        </Card>
      </Section>

      <Section title={t.settings.calendars}>
        <Card>
          <ThemedText type="small" themeColor="text2">
            {t.settings.calendarsHint}
          </ThemedText>
          {!deviceCalendarSupported ? (
            <ThemedText themeColor="text2">{t.settings.notSupported}</ThemedText>
          ) : !calOk ? (
            <Button label={t.settings.calendarsAllow} icon="calendar" onPress={() => void allowCalendars()} />
          ) : (
            <>
              {calendars.map((c) => (
                <Row key={c.id} style={styles.between}>
                  <View style={[styles.swatch, { backgroundColor: c.color ?? theme.accent }]} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{c.title}</ThemedText>
                    <ThemedText type="small" themeColor="text2" numberOfLines={1}>
                      {c.source}
                    </ThemedText>
                  </View>
                  <Switch
                    value={settings.deviceCalendarIds.includes(c.id)}
                    onValueChange={(on) => toggleCalendar(c.id, on)}
                  />
                </Row>
              ))}
              <ThemedText type="small" themeColor="text2">
                {t.settings.writeCalendar}
              </ThemedText>
              <Row>
                <Chip
                  label={t.common.none}
                  selected={settings.writeCalendarId == null}
                  onPress={() => void setSetting(db, 'writeCalendarId', null)}
                />
                {calendars
                  .filter((c) => c.writable)
                  .map((c) => (
                    <Chip
                      key={c.id}
                      label={c.title}
                      color={c.color}
                      selected={settings.writeCalendarId === c.id}
                      onPress={() => void setSetting(db, 'writeCalendarId', c.id)}
                    />
                  ))}
              </Row>
            </>
          )}
        </Card>
      </Section>

      <Section title={t.plan.capacity}>
        <ThemedText type="small" themeColor="text2">
          {t.plan.capacityHint}
        </ThemedText>
        <Row>
          {[240, 360, 420, 480, 540, 600].map((m) => (
            <Chip key={m} label={fmtMinutes(m)} selected={settings.dayCapacityMinutes === m} onPress={() => void setSetting(db, 'dayCapacityMinutes', m)} />
          ))}
        </Row>
        <ThemedText type="small" themeColor="text2">
          {t.plan.sleepFrom}
        </ThemedText>
        <Row>
          {[21, 22, 23, 0, 1].map((h) => (
            <Chip key={h} label={`${h}:00`} selected={settings.sleepStartHour === h} onPress={() => void setSetting(db, 'sleepStartHour', h)} />
          ))}
        </Row>
        <ThemedText type="small" themeColor="text2">
          {t.plan.sleepTo}
        </ThemedText>
        <Row>
          {[5, 6, 7, 8, 9].map((h) => (
            <Chip key={h} label={`${h}:00`} selected={settings.sleepEndHour === h} onPress={() => void setSetting(db, 'sleepEndHour', h)} />
          ))}
        </Row>
      </Section>

      <Section title={t.settings.dayStart}>
        <Row>
          {[5, 6, 7, 8, 9].map((h) => (
            <Chip key={h} label={`${h}:00`} selected={settings.dayStartHour === h} onPress={() => void setSetting(db, 'dayStartHour', h)} />
          ))}
        </Row>
      </Section>

      <Section title={t.templates.title}>
        <Button variant="secondary" label={t.templates.title} onPress={() => router.push('/templates')} />
      </Section>

      <Section title={t.settings.data}>
        <Button variant="secondary" label={t.settings.exportJson} onPress={() => void exportJson()} />
        <Button variant="secondary" label={t.settings.exportIcs} onPress={() => void exportIcs()} />
        <Button variant="secondary" label={t.settings.importJson} onPress={() => void importJson()} />
        <ThemedText type="small" themeColor="text2">
          Všetky dáta sú uložené len v tomto zariadení.
        </ThemedText>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  between: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  swatch: { width: 12, height: 12, borderRadius: 6 },
});
