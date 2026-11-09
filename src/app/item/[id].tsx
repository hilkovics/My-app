import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ItemRow } from '@/components/item-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Checkbox, Chip, Empty, Field, IconButton, Input, Row, Section, Segmented } from '@/components/ui';
import { ITEM_COLORS, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import type { Item, ItemType } from '@/db/types';
import { copyEventToDevice, deviceCalendarSupported } from '@/features/calendar/device';
import {
  addChecklistEntry,
  convertItem,
  deleteChecklistEntry,
  deleteItem,
  getExternalLink,
  getItem,
  linkExternal,
  listAlerts,
  listChecklist,
  listLinkedItems,
  normalizeTags,
  setAlerts,
  setChecklistDone,
  setEnergy,
  setEstimate,
  setTaskStatus,
  toggleTaskDone,
  unlinkItems,
  updateItem,
} from '@/features/items/repository';
import { startFocus } from '@/features/focus/controller';
import { itemFocusMinutes } from '@/features/focus/repository';
import { fmtMinutes } from '@/features/focus/stats';
import { getEventLinkForNote, listSeriesNotes } from '@/features/items/event-notes';
import { ALERT_PRESETS, describeOffset } from '@/features/notifications/plan';
import { hasPermission, requestPermission, supported as notificationsSupported } from '@/features/notifications/scheduler';
import { listProjects } from '@/features/projects/repository';
import { getSettings } from '@/features/settings/repository';
import { templateFromItem } from '@/features/templates/repository';
import { EnergyChips, EstimateChips } from '@/components/plan/estimate-chips';
import { STATUSES } from '@/components/status-picker';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { goBack } from '@/lib/nav';
import { confirm, notify } from '@/lib/confirm';
import { HOUR, WEEKDAYS_SHORT, endOfDay, fmtDateTime, fmtTime, startOfDay } from '@/lib/dates';
import { describeRule, formatRule, parseRule, weekdayOf, type Freq, type Rule } from '@/lib/recurrence';

type Draft = Pick<
  Item,
  'title' | 'body' | 'color' | 'pinned' | 'startAt' | 'endAt' | 'allDay' | 'dueAt' | 'priority' | 'rrule'
> & { tagsText: string };

function toDraft(i: Item): Draft {
  return {
    title: i.title,
    body: i.body,
    color: i.color,
    pinned: i.pinned,
    startAt: i.startAt,
    endAt: i.endAt,
    allDay: i.allDay,
    dueAt: i.dueAt,
    priority: i.priority,
    rrule: i.rrule,
    tagsText: i.tags.join(', '),
  };
}

const FREQ_OPTIONS: { value: Freq | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'Nie' },
  { value: 'DAILY', label: 'Denne' },
  { value: 'WEEKLY', label: 'Týždenne' },
  { value: 'MONTHLY', label: 'Mesačne' },
  { value: 'YEARLY', label: 'Ročne' },
];

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const theme = useTheme();
  const item = useLiveQuery((d) => getItem(d, id), [id]);
  const checklist = useLiveQuery((d) => listChecklist(d, id), [id]) ?? [];
  const linked = useLiveQuery((d) => listLinkedItems(d, id), [id]) ?? [];
  const alerts = useLiveQuery((d) => listAlerts(d, id), [id]) ?? [];
  const external = useLiveQuery((d) => getExternalLink(d, id), [id]);
  const eventLink = useLiveQuery((d) => getEventLinkForNote(d, id), [id]);
  const eventNotes = useLiveQuery((d) => listSeriesNotes(d, 'local', id), [id]) ?? [];
  const focusMinutes = useLiveQuery((d) => itemFocusMinutes(d, id), [id]) ?? 0;
  const settings = useLiveQuery((d) => getSettings(d), []);
  const projects = useLiveQuery((d) => listProjects(d, ['active', 'done']), []) ?? [];
  const [waitingEdit, setWaitingEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newEntry, setNewEntry] = useState('');
  const loadedFor = useRef<string | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Draft | null>(null);

  useEffect(() => {
    if (item && loadedFor.current !== `${item.id}:${item.type}`) {
      loadedFor.current = `${item.id}:${item.type}`;
      setDraft(toDraft(item));
    }
  }, [item]);

  // Autosave (debounced) + flush on leave.
  const save = async (d: Draft) => {
    await updateItem(db, id, {
      title: d.title,
      body: d.body,
      color: d.color,
      pinned: d.pinned,
      startAt: d.startAt,
      endAt: d.endAt,
      allDay: d.allDay,
      dueAt: d.dueAt,
      priority: d.priority,
      rrule: d.rrule,
      tags: normalizeTags(d.tagsText.split(',')),
    }).catch(() => {});
  };
  const flush = () => {
    if (pending.current && draftRef.current) {
      clearTimeout(pending.current);
      pending.current = null;
      return save(draftRef.current);
    }
    return Promise.resolve();
  };
  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<Draft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...p };
      draftRef.current = next;
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        pending.current = null;
        void save(next);
      }, 500);
      return next;
    });
  };

  if (item === null) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: theme.background }]}>
        <Empty text={t.item.notFound} />
      </View>
    );
  }
  if (!item || !draft) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  const type = item.type;
  const rule = parseRule(draft.rrule);
  const anchor = type === 'event' ? draft.startAt : (draft.startAt ?? draft.dueAt);
  const hasTime = anchor != null;

  const changeType = async (next: ItemType) => {
    if (next === type) return;
    await flush();
    const updated = await convertItem(db, id, next);
    setDraft(toDraft(updated));
    loadedFor.current = `${updated.id}:${updated.type}`;
  };

  const setRule = (r: Rule | null) => patch({ rrule: r ? formatRule(r) : null });

  const toggleAlert = async (offset: number) => {
    const current = alerts.map((a) => a.offsetMinutes);
    const next = current.includes(offset) ? current.filter((o) => o !== offset) : [...current, offset];
    if (next.length > current.length && notificationsSupported && !(await hasPermission())) {
      const ok = await requestPermission();
      if (!ok) notify(t.settings.notifications, 'Upozornenia nie sú povolené. Povoľ ich v nastaveniach telefónu.');
    }
    await flush();
    await setAlerts(db, id, next);
  };

  const remove = async () => {
    if (await confirm(t.common.confirmDelete, item.title, t.common.delete)) {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      await deleteItem(db, id);
      goBack();
    }
  };

  const copyToDevice = async () => {
    if (!settings?.writeCalendarId) {
      notify(t.item.copyToDevice, 'Najprv vyber kalendár v Nastaveniach.');
      return;
    }
    await flush();
    const fresh = await getItem(db, id);
    if (!fresh) return;
    const eventId = await copyEventToDevice(settings.writeCalendarId, fresh);
    await linkExternal(db, id, settings.writeCalendarId, eventId);
    notify(t.item.copied);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t.types[type],
          headerRight: () => (
            <IconButton name="trash" label={t.common.delete} color={theme.danger} onPress={() => void remove()} />
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Segmented<ItemType>
          value={type}
          onChange={(v) => void changeType(v)}
          options={[
            { value: 'task', label: t.types.task },
            { value: 'event', label: t.types.event },
            { value: 'note', label: t.types.note },
          ]}
        />

        {type === 'note' && eventLink ? (
          <Button
            small
            variant="secondary"
            icon="calendar"
            label={`${t.eventNotes.belongsTo}: ${eventLink.eventTitle || t.common.untitled} · ${fmtDateTime(eventLink.occurrenceStart)}`}
            disabled={eventLink.source !== 'local'}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: eventLink.eventId } })}
          />
        ) : null}

        <Row style={styles.titleRow}>
          {type === 'task' ? (
            <Checkbox
              checked={item.completedAt != null}
              color={draft.color}
              label={t.item.done}
              onPress={() =>
                void flush()
                  .then(() => toggleTaskDone(db, id))
                  .then((u) => setDraft(toDraft(u)))
              }
            />
          ) : null}
          <View style={styles.flex}>
            <Input value={draft.title} onChangeText={(title) => patch({ title })} placeholder={t.item.title} big />
          </View>
        </Row>

        {type !== 'note' ? (
          <Row style={styles.focusRow}>
            <Button
              small
              icon="play"
              label={t.focus.startOnItem}
              onPress={() =>
                void flush()
                  .then(() => startFocus(db, { mode: 'pomodoro', plannedMinutes: settings?.pomodoroMinutes ?? 25, itemId: id }))
                  .then(() => router.navigate({ pathname: '/progress', params: { section: 'focus' } }))
              }
            />
            {focusMinutes >= 1 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t.focus.worked}: {fmtMinutes(focusMinutes)}
              </ThemedText>
            ) : null}
          </Row>
        ) : null}

        {type === 'event' ? (
          <>
            <Row>
              <Chip
                label={t.common.allDay}
                selected={draft.allDay}
                onPress={() => {
                  const s = draft.startAt ?? Date.now();
                  if (!draft.allDay) patch({ allDay: true, startAt: startOfDay(s), endAt: endOfDay(draft.endAt ?? s) });
                  else patch({ allDay: false, startAt: startOfDay(s) + 9 * HOUR, endAt: startOfDay(s) + 10 * HOUR });
                }}
              />
            </Row>
            <Field label={t.item.start}>
              <DateTimeField
                value={draft.startAt}
                allowClear={false}
                withTime={!draft.allDay}
                onChange={(v) => {
                  if (v == null) return;
                  const duration = Math.max(0, (draft.endAt ?? v) - (draft.startAt ?? v));
                  patch({ startAt: v, endAt: draft.allDay ? endOfDay(v + duration) : v + (duration || HOUR) });
                }}
              />
            </Field>
            <Field label={t.item.end}>
              <DateTimeField
                value={draft.endAt}
                allowClear={false}
                withTime={!draft.allDay}
                onChange={(v) => {
                  if (v == null) return;
                  const end = draft.allDay ? endOfDay(v) : v;
                  patch({ endAt: draft.startAt != null && end < draft.startAt ? draft.startAt : end });
                }}
              />
            </Field>
          </>
        ) : null}

        {type === 'task' ? (
          <>
            <Field label={t.item.due}>
              <DateTimeField value={draft.dueAt} onChange={(dueAt) => patch({ dueAt })} />
            </Field>
            <Field label={t.item.block}>
              {draft.startAt != null ? (
                <Row>
                  <ThemedText>
                    {fmtDateTime(draft.startAt)}–{fmtTime(draft.endAt ?? draft.startAt)}
                  </ThemedText>
                  <Button
                    small
                    variant="secondary"
                    label="Zrušiť blok"
                    onPress={() => patch({ startAt: null, endAt: null })}
                  />
                </Row>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t.item.noBlock} – naplánuješ v Kalendári (týždeň/deň).
                </ThemedText>
              )}
            </Field>
            <Field label={t.item.status}>
              <Row>
                {STATUSES.map((s) => (
                  <Chip
                    key={s}
                    label={t.status[s]}
                    selected={(item.completedAt != null ? 'done' : (item.status ?? 'todo')) === s}
                    onPress={() =>
                      void flush()
                        .then(() => setTaskStatus(db, id, s))
                        .then((u) => setDraft(toDraft(u)))
                    }
                  />
                ))}
              </Row>
              {item.status === 'waiting' && item.completedAt == null ? (
                <Input
                  value={waitingEdit ?? item.waitingFor ?? ''}
                  onChangeText={setWaitingEdit}
                  placeholder={t.board.waitingPlaceholder}
                  accessibilityLabel={t.board.waitingFor}
                  onBlur={() => {
                    if (waitingEdit != null) void updateItem(db, id, { waitingFor: waitingEdit.trim() || null }).then(() => setWaitingEdit(null));
                  }}
                />
              ) : null}
            </Field>
            <Field label={t.item.priority}>
              <Row>
                {['Žiadna', '!', '!!', '!!!'].map((label, p) => (
                  <Chip key={p} label={label} selected={draft.priority === p} onPress={() => patch({ priority: p })} />
                ))}
              </Row>
            </Field>
          </>
        ) : null}

        {type !== 'note' ? (
          <Field label={t.plan.energy}>
            <EnergyChips
              value={item.energy}
              onChange={(e) =>
                void flush()
                  .then(() => setEnergy(db, id, e))
                  .then((u) => setDraft(toDraft(u)))
              }
            />
          </Field>
        ) : null}
        {type === 'task' ? (
          <Field label={t.plan.estimate}>
            <EstimateChips
              value={item.estimateMinutes}
              onChange={(m) =>
                void flush()
                  .then(() => setEstimate(db, id, m))
                  .then((u) => setDraft(toDraft(u)))
              }
            />
          </Field>
        ) : null}

        {type !== 'note' ? (
          <Field label={`${t.item.repeat}: ${describeRule(rule)}`}>
            {hasTime ? (
              <>
                <Row>
                  {FREQ_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      selected={(rule?.freq ?? 'NONE') === o.value}
                      onPress={() =>
                        setRule(
                          o.value === 'NONE'
                            ? null
                            : {
                                freq: o.value,
                                interval: 1,
                                byDay: o.value === 'WEEKLY' && anchor != null ? [weekdayOf(anchor)] : undefined,
                              },
                        )
                      }
                    />
                  ))}
                </Row>
                {rule ? (
                  <Row>
                    <ThemedText type="small" themeColor="textSecondary">
                      Každých
                    </ThemedText>
                    <Button small variant="secondary" label="−" onPress={() => setRule({ ...rule, interval: Math.max(1, rule.interval - 1) })} />
                    <ThemedText type="smallBold">{rule.interval}</ThemedText>
                    <Button small variant="secondary" label="+" onPress={() => setRule({ ...rule, interval: rule.interval + 1 })} />
                  </Row>
                ) : null}
                {rule?.freq === 'WEEKLY' ? (
                  <Row>
                    {WEEKDAYS_SHORT.map((d, i) => {
                      const on = rule.byDay?.includes(i) ?? false;
                      return (
                        <Chip
                          key={d}
                          label={d}
                          selected={on}
                          onPress={() => {
                            const days = on ? (rule.byDay ?? []).filter((x) => x !== i) : [...(rule.byDay ?? []), i];
                            setRule({ ...rule, byDay: days.length ? days.sort((a, b) => a - b) : undefined });
                          }}
                        />
                      );
                    })}
                  </Row>
                ) : null}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Najprv nastav termín.
              </ThemedText>
            )}
          </Field>
        ) : null}

        {type !== 'note' && hasTime ? (
          <Field label={t.item.alerts}>
            <Row>
              {ALERT_PRESETS.map((off) => (
                <Chip
                  key={off}
                  label={describeOffset(off)}
                  selected={alerts.some((a) => a.offsetMinutes === off)}
                  onPress={() => void toggleAlert(off)}
                />
              ))}
            </Row>
            {!notificationsSupported ? (
              <ThemedText type="small" themeColor="textSecondary">
                Upozornenia fungujú v mobilnej aplikácii.
              </ThemedText>
            ) : null}
          </Field>
        ) : null}

        <Field label={t.item.body}>
          <Input value={draft.body} onChangeText={(body) => patch({ body })} placeholder={t.item.body} multiline />
        </Field>

        <Field label={t.item.tags}>
          <Input value={draft.tagsText} onChangeText={(tagsText) => patch({ tagsText })} placeholder={t.item.tagsPlaceholder} autoCapitalize="none" />
        </Field>

        <Field label={t.projects.project}>
          <Row>
            <Chip label={t.projects.none} selected={item.projectId == null} onPress={() => void updateItem(db, id, { projectId: null })} />
            {projects.map((p) => (
              <Chip
                key={p.id}
                label={`${p.icon} ${p.name}`}
                selected={item.projectId === p.id}
                onPress={() => void updateItem(db, id, { projectId: item.projectId === p.id ? null : p.id })}
              />
            ))}
          </Row>
        </Field>

        <Field label={t.item.color}>
          <Row>
            <Chip label="—" selected={draft.color == null} onPress={() => patch({ color: null })} />
            {ITEM_COLORS.map((c) => (
              <Chip key={c} label={draft.color === c ? '✓' : ' '} color={c} selected onPress={() => patch({ color: c })} />
            ))}
            <Chip label={`📌 ${t.item.pinned}`} selected={draft.pinned} onPress={() => patch({ pinned: !draft.pinned })} />
          </Row>
        </Field>

        {type === 'event' && eventNotes.length ? (
          <Section title={t.eventNotes.seriesNotes}>
            <View>
              {eventNotes.map((n) => (
                <ItemRow key={n.id} item={n} />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title={t.item.checklist}>
          {checklist.map((c) => (
            <Row key={c.id} style={styles.checkRow}>
              <Checkbox checked={c.done} label={c.text} onPress={() => void setChecklistDone(db, c.id, !c.done)} />
              <ThemedText
                style={[styles.flex, c.done && { textDecorationLine: 'line-through', color: theme.textSecondary }]}>
                {c.text}
              </ThemedText>
              <IconButton name="close" size={16} label={t.common.delete} color={theme.textSecondary} onPress={() => void deleteChecklistEntry(db, c.id)} />
            </Row>
          ))}
          <Input
            value={newEntry}
            onChangeText={setNewEntry}
            placeholder={t.item.addChecklist}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => {
              if (newEntry.trim()) void addChecklistEntry(db, id, newEntry.trim()).then(() => setNewEntry(''));
            }}
          />
        </Section>

        <Section
          title={t.item.links}
          right={
            <Button
              small
              variant="ghost"
              icon="link"
              label={t.item.addLink}
              onPress={() => router.push({ pathname: '/item/link', params: { from: id } })}
            />
          }>
          {linked.map((l) => (
            <Row key={l.id}>
              <View style={styles.flex}>
                <ItemRow item={l} />
              </View>
              <IconButton name="close" size={16} label="Zrušiť prepojenie" color={theme.textSecondary} onPress={() => void unlinkItems(db, id, l.id)} />
            </Row>
          ))}
          {external ? (
            <ThemedText type="small" themeColor="textSecondary">
              📱 Prepojené s udalosťou v kalendári telefónu
            </ThemedText>
          ) : null}
        </Section>

        {type === 'event' && deviceCalendarSupported && !external ? (
          <Button variant="secondary" icon="phone" label={t.item.copyToDevice} onPress={() => void copyToDevice()} />
        ) : null}

        {type !== 'event' ? (
          <Button
            variant="secondary"
            label={t.templates.saveAs}
            onPress={() =>
              void flush()
                .then(() => templateFromItem(db, id))
                .then(() => notify(t.templates.saved))
            }
          />
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          Vytvorené {fmtDateTime(item.createdAt)} · upravené {fmtDateTime(item.updatedAt)}
        </ThemedText>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: 80,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleRow: { flexWrap: 'nowrap' },
  focusRow: { justifyContent: 'space-between' },
  checkRow: { flexWrap: 'nowrap' },
  meta: { textAlign: 'center' },
});
