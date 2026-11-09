import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Input, Row, Segmented } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import type { ItemType } from '@/db/types';
import { parseQuickAdd, toItemInput, type Parsed } from '@/features/quickadd/parse';
import { getSettings } from '@/features/settings/repository';
import { useGuardedCreate } from '@/components/plan/capacity-guard';
import { openCreated } from '@/features/templates/open';
import { applyTemplate, listTemplates } from '@/features/templates/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { goBack } from '@/lib/nav';
import { fmtDateTime, fmtTime, minutesOfDay, startOfDay } from '@/lib/dates';
import { describeRule } from '@/lib/recurrence';

/** Quick add: one line of text, parsed for date/time/tags/…; type is switchable. */
export default function NewItemScreen() {
  const params = useLocalSearchParams<{ type?: ItemType; start?: string; date?: string; projectId?: string }>();
  const db = useDb();
  const theme = useTheme();
  const settings = useLiveQuery((d) => getSettings(d), []);
  const templates = useLiveQuery((d) => listTemplates(d), []) ?? [];
  const { create: createGuarded, dialog } = useGuardedCreate();
  const [type, setType] = useState<ItemType>(params.type ?? 'task');
  const [text, setText] = useState('');
  const [body, setBody] = useState('');

  // Prefill from the calendar (tapped slot or selected day) unless the text says otherwise.
  const prefillStart = params.start ? Number(params.start) : null;
  const prefillDay = params.date ? Number(params.date) : null;
  const parsed: Parsed = parseQuickAdd(text);
  if (parsed.day == null && (prefillStart != null || prefillDay != null)) {
    parsed.day = startOfDay(prefillStart ?? prefillDay!);
    if (prefillStart != null && parsed.minutes == null) parsed.minutes = minutesOfDay(prefillStart);
  }

  const input = toItemInput(parsed, type);
  const summary: string[] = [];
  if (type === 'event' && input.startAt != null) {
    summary.push(
      input.allDay ? fmtDateTime(input.startAt, true) : `${fmtDateTime(input.startAt)}–${fmtTime(input.endAt ?? input.startAt)}`,
    );
  }
  if (type === 'task' && input.dueAt != null) summary.push(`${t.item.due}: ${fmtDateTime(input.dueAt, parsed.minutes == null)}`);
  if (type !== 'note' && parsed.rule) summary.push(describeRule(parsed.rule));
  if (parsed.priority) summary.push(`${t.item.priority} ${parsed.priority}`);
  if (parsed.tags.length) summary.push(parsed.tags.map((x) => `#${x}`).join(' '));
  if (parsed.alerts.length) summary.push(`🔔 ${parsed.alerts.map((a) => (a ? `${a} min` : 'v čase')).join(', ')}`);

  const create = async (thenEdit: boolean) => {
    if (!parsed.title && !body.trim()) return;
    const timed = type === 'event' || (type === 'task' && (input.dueAt != null || input.startAt != null));
    const alerts = parsed.alerts.length ? parsed.alerts : type === 'event' ? (settings?.defaultAlerts ?? []) : [];
    await createGuarded(
      { ...input, title: parsed.title, body: body.trim(), projectId: params.projectId ?? null },
      {
        alerts: timed ? alerts : [],
        onCreated: (item) => {
          if (thenEdit) router.replace({ pathname: '/item/[id]', params: { id: item.id } });
          else goBack();
        },
      },
    );
  };

  return (
    <>
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Segmented<ItemType>
        value={type}
        onChange={setType}
        options={[
          { value: 'task', label: t.types.task },
          { value: 'event', label: t.types.event },
          { value: 'note', label: t.types.note },
        ]}
      />
      {templates.some((tpl) => tpl.kind === type) ? (
        <Field label={t.templates.fromTemplate}>
          <Row>
            {templates
              .filter((tpl) => tpl.kind === type)
              .map((tpl) => (
                <Chip
                  key={tpl.id}
                  label={`${tpl.icon} ${tpl.name}`}
                  onPress={() => void applyTemplate(db, tpl, { projectId: params.projectId ?? null }).then((c) => {
                      router.dismiss();
                      openCreated(c);
                    })}
                />
              ))}
          </Row>
        </Field>
      ) : null}
      <Input
        value={text}
        onChangeText={setText}
        placeholder={t.quickAdd.placeholder}
        autoFocus
        big
        returnKeyType="done"
        onSubmitEditing={() => void create(false)}
      />
      {text.trim() ? (
        <Card>
          <ThemedText type="smallBold">{parsed.title || t.common.untitled}</ThemedText>
          {summary.length ? (
            <ThemedText type="small" themeColor="text2">
              {summary.join(' · ')}
            </ThemedText>
          ) : null}
        </Card>
      ) : (
        <ThemedText type="small" themeColor="text2">
          {t.quickAdd.hint}
        </ThemedText>
      )}
      <Input value={body} onChangeText={setBody} placeholder={t.item.body} multiline />
      <Row>
        <Button label={t.common.create} onPress={() => void create(false)} disabled={!parsed.title && !body.trim()} />
        <Button
          variant="secondary"
          label={t.quickAdd.createAndEdit}
          onPress={() => void create(true)}
          disabled={!parsed.title && !body.trim()}
        />
      </Row>
    </ScrollView>
    {dialog}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
