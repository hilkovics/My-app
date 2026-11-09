import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, Input, Row, Segmented } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { normalizeTags } from '@/features/items/repository';
import { formatProjectTasks, parseLines, parseProjectTasks } from '@/features/templates/format';
import { openCreated } from '@/features/templates/open';
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplate,
  updateTemplate,
  type Template,
} from '@/features/templates/repository';
import type { NotePayload, ProjectPayload, TaskPayload, TemplateKind, TemplatePayload } from '@/features/templates/types';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm } from '@/lib/confirm';
import { WEEKDAYS_SHORT, fmtDateLong, snapToWeekday, startOfDay, weekdayIndex } from '@/lib/dates';
import { goBack } from '@/lib/nav';
import { formatRule, nextOccurrence, parseRule, type Freq } from '@/lib/recurrence';


const ICONS = ['📋', '🗓️', '🤝', '🛒', '🧳', '🎤', '📝', '☑️', '📊', '🏋️', '🧹', '💡'];
type Repeat = 'none' | Freq;
type DueMode = 'none' | 'today' | 'custom';

export default function EditTemplateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const tpl = useLiveQuery((d) => (id ? getTemplate(d, id) : Promise.resolve(null)), [id ?? null]);
  if (tpl === undefined) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  return <Editor key={tpl?.id ?? 'new'} template={tpl} />;
}

function Editor({ template }: { template: Template | null }) {
  const db = useDb();
  const theme = useTheme();
  const p = template?.payload as (Partial<TaskPayload> & Partial<NotePayload> & Partial<ProjectPayload>) | undefined;
  const rule = parseRule(template?.rrule);

  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? 'task');
  const [name, setName] = useState(template?.name ?? '');
  const [icon, setIcon] = useState(template?.icon ?? '📋');
  const [title, setTitle] = useState(p?.title ?? p?.name ?? '');
  const [body, setBody] = useState(p?.body ?? p?.description ?? '');
  const [tags, setTags] = useState((p?.tags ?? []).join(', '));
  const [priority, setPriority] = useState(p?.priority ?? 0);
  const [dueMode, setDueMode] = useState<DueMode>(p?.dueOffsetDays == null ? 'none' : p.dueOffsetDays === 0 ? 'today' : 'custom');
  const [dueDays, setDueDays] = useState(String(p?.dueOffsetDays && p.dueOffsetDays > 0 ? p.dueOffsetDays : 1));
  const [checklist, setChecklist] = useState((p?.checklist ?? []).join('\n'));
  const [projectTasks, setProjectTasks] = useState(formatProjectTasks(p?.tasks ?? []));
  const [deadlineDays, setDeadlineDays] = useState(p?.deadlineOffsetDays != null ? String(p.deadlineOffsetDays) : '');
  const [repeat, setRepeat] = useState<Repeat>(rule?.freq ?? 'none');
  const [weekday, setWeekday] = useState(() => rule?.byDay?.[0] ?? weekdayIndex(Date.now()));
  const [startAt, setStartAt] = useState<number | null>(() => template?.anchorAt ?? startOfDay(Date.now()));

  const dueOffset = dueMode === 'none' ? null : dueMode === 'today' ? 0 : Math.max(0, Math.round(Number(dueDays) || 0));
  const effectiveTitle = title.trim();

  const buildPayload = (): TemplatePayload => {
    if (kind === 'project') {
      const days = deadlineDays.trim() === '' ? null : Math.max(0, Math.round(Number(deadlineDays) || 0));
      return { name: effectiveTitle, icon, description: body.trim(), deadlineOffsetDays: days, tasks: parseProjectTasks(projectTasks) } satisfies ProjectPayload;
    }
    const base = { title: effectiveTitle, body: body.trim(), tags: normalizeTags(tags.split(',')), checklist: parseLines(checklist) };
    return kind === 'task' ? ({ ...base, priority, dueOffsetDays: dueOffset } satisfies TaskPayload) : (base satisfies NotePayload);
  };

  const today = startOfDay(useNow());
  const anchor = repeat === 'none' ? null : repeat === 'WEEKLY' ? snapToWeekday(startAt ?? today, weekday) : startOfDay(startAt ?? today);
  const rrule = repeat === 'none' ? null : formatRule({ freq: repeat, interval: 1, ...(repeat === 'WEEKLY' ? { byDay: [weekday] } : {}) });
  const next = anchor != null && rrule ? nextOccurrence(anchor, parseRule(rrule), (template?.lastRunAt ?? anchor - 1)) : null;
  const valid = name.trim() && effectiveTitle;

  const save = async () => {
    if (!valid) return;
    const input = { name: name.trim(), icon, kind, payload: buildPayload(), rrule, anchorAt: anchor };
    if (template) await updateTemplate(db, template.id, input);
    else await createTemplate(db, input);
    goBack();
  };

  const remove = async () => {
    if (template && (await confirm(t.templates.delete, template.name, t.common.delete))) {
      await deleteTemplate(db, template.id);
      goBack();
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label={t.templates.name}>
        <Input value={name} onChangeText={setName} placeholder="napr. Týždenná revízia" big autoFocus={!template} />
      </Field>
      <Field label={t.templates.icon}>
        <Row>
          {ICONS.map((i) => (
            <Chip key={i} label={i} selected={icon === i} onPress={() => setIcon(i)} />
          ))}
        </Row>
      </Field>
      {!template ? (
        <Field label={t.templates.kind}>
          <Segmented<TemplateKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'task', label: t.templates.task },
              { value: 'note', label: t.templates.note },
              { value: 'project', label: t.templates.project },
            ]}
          />
        </Field>
      ) : null}

      <Field label={kind === 'project' ? t.templates.projectName : t.templates.recordTitle}>
        <Input value={title} onChangeText={setTitle} />
        <ThemedText type="small" themeColor="textSecondary">
          {t.templates.titleHint}
        </ThemedText>
      </Field>
      <Field label={kind === 'project' ? t.templates.description : t.templates.body}>
        <Input value={body} onChangeText={setBody} multiline style={styles.multi} />
      </Field>

      {kind !== 'project' ? (
        <Field label={t.templates.tags}>
          <Input value={tags} onChangeText={setTags} autoCapitalize="none" placeholder={t.item.tagsPlaceholder} />
        </Field>
      ) : null}

      {kind === 'task' ? (
        <>
          <Field label={t.templates.priority}>
            <Row>
              {['Žiadna', '!', '!!', '!!!'].map((label, i) => (
                <Chip key={i} label={label} selected={priority === i} onPress={() => setPriority(i)} />
              ))}
            </Row>
          </Field>
          <Field label={t.templates.due}>
            <Row>
              <Chip label={t.templates.dueNone} selected={dueMode === 'none'} onPress={() => setDueMode('none')} />
              <Chip label={t.templates.dueToday} selected={dueMode === 'today'} onPress={() => setDueMode('today')} />
              <Chip label={t.templates.dueIn} selected={dueMode === 'custom'} onPress={() => setDueMode('custom')} />
            </Row>
            {dueMode === 'custom' ? <Input value={dueDays} onChangeText={setDueDays} keyboardType="number-pad" style={styles.small} /> : null}
          </Field>
        </>
      ) : null}

      {kind !== 'project' ? (
        <Field label={t.templates.checklist}>
          <Input value={checklist} onChangeText={setChecklist} multiline style={styles.multi} />
        </Field>
      ) : (
        <>
          <Field label={t.templates.deadline}>
            <Input value={deadlineDays} onChangeText={setDeadlineDays} keyboardType="number-pad" placeholder="napr. 42" style={styles.small} />
          </Field>
          <Field label={t.templates.projectTasks}>
            <Input value={projectTasks} onChangeText={setProjectTasks} multiline style={styles.multi} autoCapitalize="sentences" />
            <ThemedText type="small" themeColor="textSecondary">
              {t.templates.projectTasksHint}
            </ThemedText>
          </Field>
        </>
      )}

      <Field label={t.templates.repeat}>
        <Row>
          {(
            [
              ['none', t.templates.repeatNone],
              ['DAILY', t.templates.repeatDaily],
              ['WEEKLY', t.templates.repeatWeekly],
              ['MONTHLY', t.templates.repeatMonthly],
            ] as [Repeat, string][]
          ).map(([value, label]) => (
            <Chip key={value} label={label} selected={repeat === value} onPress={() => setRepeat(value)} />
          ))}
        </Row>
        {repeat === 'WEEKLY' ? (
          <Row>
            {WEEKDAYS_SHORT.map((d, i) => (
              <Chip key={d} label={d} selected={weekday === i} onPress={() => setWeekday(i)} />
            ))}
          </Row>
        ) : null}
        {repeat !== 'none' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {t.templates.repeatFrom}
            </ThemedText>
            <DateTimeField value={startAt} withTime={false} allowClear={false} onChange={setStartAt} />
            {next != null ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t.templates.next}: {fmtDateLong(next)}
              </ThemedText>
            ) : null}
          </>
        ) : null}
      </Field>

      <Button label={t.common.save} onPress={() => void save()} disabled={!valid} />
      {template ? (
        <Row>
          <Button variant="secondary" label={t.templates.createNow} onPress={() => void applyTemplate(db, template).then(openCreated)} />
          <Button variant="danger" icon="trash" label={t.common.delete} onPress={() => void remove()} />
        </Row>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  multi: { minHeight: 110 },
  small: { width: 120 },
});
