import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, Input, Row, Segmented, Swatch } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  createActivity,
  deleteActivity,
  getActivity,
  updateActivity,
  type Activity,
  type ActivityInput,
  type ActivityKind,
  type GoalType,
} from '@/features/activities/repository';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm } from '@/lib/confirm';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { goBack } from '@/lib/nav';

const ICONS = ['🎸', '🎹', '🥁', '🎻', '🎤', '🎧', '🎛️', '🏃', '🚴', '🏊', '🧘', '🏋️', '📚', '✍️', '💧', '💊', '✓', '⭐'];

type Draft = Required<Pick<ActivityInput, 'name' | 'icon' | 'kind' | 'trackDistance' | 'trackRating' | 'days' | 'targetPerDay'>> & {
  colorSlot: number | null;
  goalType: GoalType | null;
  goalValue: number | null;
};

const TEMPLATES: { label: string; draft: Partial<Draft> }[] = [
  {
    label: '🎸 Hudobný nástroj',
    draft: { name: 'Gitara', icon: '🎸', kind: 'timed', trackDistance: false, trackRating: true, goalType: 'sessions', goalValue: 3 },
  },
  {
    label: '🏃 Beh',
    draft: { name: 'Beh', icon: '🏃', kind: 'timed', trackDistance: true, trackRating: false, goalType: 'km', goalValue: 15 },
  },
  {
    label: '🎧 Mixovanie hudby',
    draft: { name: 'Mixovanie hudby', icon: '🎧', kind: 'timed', trackDistance: false, trackRating: true, goalType: 'minutes', goalValue: 180 },
  },
  {
    label: '✓ Návyk',
    draft: { name: '', icon: '💧', kind: 'check', trackDistance: false, trackRating: false, goalType: null, goalValue: null },
  },
];

const GOAL_STEP: Record<GoalType, number> = { sessions: 1, minutes: 30, km: 5 };
const GOAL_DEFAULT: Record<GoalType, number> = { sessions: 3, minutes: 150, km: 15 };

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const activity = useLiveQuery((d) => (id ? getActivity(d, id) : Promise.resolve(null)), [id ?? null]);
  if (id && activity === undefined) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return <Editor key={activity?.id ?? 'new'} activity={activity ?? null} />;
}

function Editor({ activity }: { activity: Activity | null }) {
  const db = useDb();
  const theme = useTheme();
  const { slots } = useChartColors();
  const [d, setD] = useState<Draft>(() => ({
    name: activity?.name ?? '',
    icon: activity?.icon ?? '⭐',
    kind: activity?.kind ?? 'timed',
    trackDistance: activity?.trackDistance ?? false,
    trackRating: activity?.trackRating ?? false,
    days: activity?.days ?? '1111111',
    targetPerDay: activity?.targetPerDay ?? 1,
    colorSlot: activity?.colorSlot ?? null,
    goalType: activity?.goalType ?? null,
    goalValue: activity?.goalValue ?? null,
  }));
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  const save = async () => {
    if (!d.name.trim()) return;
    const { colorSlot, ...rest } = d;
    const input: ActivityInput = { ...rest, ...(colorSlot != null ? { colorSlot } : {}) };
    if (activity) {
      await updateActivity(db, activity.id, input);
      goBack();
    } else {
      const created = await createActivity(db, input);
      router.replace({ pathname: '/activity/[id]', params: { id: created.id } });
    }
  };

  const remove = async () => {
    if (activity && (await confirm(t.common.confirmDelete, activity.name, t.common.delete))) {
      await deleteActivity(db, activity.id);
      router.dismissTo('/progress');
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!activity ? (
        <Field label={t.activities.templates}>
          <Row>
            {TEMPLATES.map((tpl) => (
              <Chip key={tpl.label} label={tpl.label} onPress={() => patch(tpl.draft)} />
            ))}
          </Row>
        </Field>
      ) : null}

      <Field label={t.activities.name}>
        <Input value={d.name} onChangeText={(name) => patch({ name })} placeholder="napr. Gitara" big />
      </Field>

      <Field label={t.activities.icon}>
        <Row>
          {ICONS.map((i) => (
            <Chip key={i} label={i} selected={d.icon === i} onPress={() => patch({ icon: i })} />
          ))}
        </Row>
      </Field>

      <Field label={t.activities.color}>
        <Row>
          {slots.map((c, i) => (
            <Swatch
              key={c}
              color={c}
              label={`Farba ${i + 1}`}
              selected={(d.colorSlot ?? activity?.colorSlot) === i}
              onPress={() => patch({ colorSlot: i })}
            />
          ))}
        </Row>
        {d.colorSlot == null && !activity ? (
          <ThemedText type="small" themeColor="text2">
            Farba sa priradí automaticky.
          </ThemedText>
        ) : null}
      </Field>

      <Field label={t.activities.kind}>
        <Segmented<ActivityKind>
          value={d.kind}
          onChange={(kind) => patch({ kind })}
          options={[
            { value: 'timed', label: t.activities.kindTimed },
            { value: 'check', label: t.activities.kindCheck },
          ]}
        />
      </Field>

      {d.kind === 'timed' ? (
        <Row>
          <Chip label={`📏 ${t.activities.trackDistance}`} selected={d.trackDistance} onPress={() => patch({ trackDistance: !d.trackDistance })} />
          <Chip label={t.activities.trackRating} selected={d.trackRating} onPress={() => patch({ trackRating: !d.trackRating })} />
        </Row>
      ) : (
        <>
          <Field label={t.activities.days}>
            <Row>
              {WEEKDAYS_SHORT.map((w, i) => (
                <Chip
                  key={w}
                  label={w}
                  selected={d.days[i] === '1'}
                  onPress={() => patch({ days: d.days.slice(0, i) + (d.days[i] === '1' ? '0' : '1') + d.days.slice(i + 1) })}
                />
              ))}
            </Row>
          </Field>
          <Field label={t.activities.targetPerDay}>
            <Stepper value={d.targetPerDay} step={1} min={1} unit="×" onChange={(targetPerDay) => patch({ targetPerDay })} />
          </Field>
        </>
      )}

      <Field label={t.activities.weeklyGoal}>
        <Row>
          <Chip label={t.activities.goalNone} selected={!d.goalType} onPress={() => patch({ goalType: null, goalValue: null })} />
          {(['sessions', 'minutes', 'km'] as GoalType[])
            .filter((g) => g !== 'km' || (d.kind === 'timed' && d.trackDistance))
            .filter((g) => g === 'sessions' || d.kind === 'timed')
            .map((g) => (
              <Chip
                key={g}
                label={g === 'sessions' ? t.activities.goalSessions : g === 'minutes' ? t.activities.goalMinutes : t.activities.goalKm}
                selected={d.goalType === g}
                onPress={() => patch({ goalType: g, goalValue: d.goalType === g ? d.goalValue : GOAL_DEFAULT[g] })}
              />
            ))}
        </Row>
        {d.goalType ? (
          <Stepper
            value={d.goalValue ?? GOAL_DEFAULT[d.goalType]}
            step={GOAL_STEP[d.goalType]}
            min={GOAL_STEP[d.goalType]}
            unit={d.goalType === 'sessions' ? '× týždenne' : d.goalType === 'minutes' ? 'min týždenne' : 'km týždenne'}
            onChange={(goalValue) => patch({ goalValue })}
          />
        ) : null}
      </Field>

      <Button label={t.common.save} onPress={() => void save()} disabled={!d.name.trim()} />

      {activity ? (
        <Row>
          <Button
            variant="secondary"
            label={activity.archived ? t.activities.unarchive : t.activities.archive}
            onPress={() => void updateActivity(db, activity.id, { archived: !activity.archived }).then(goBack)}
          />
          <Button variant="danger" icon="trash" label={t.common.delete} onPress={() => void remove()} />
        </Row>
      ) : null}
    </ScrollView>
  );
}

function Stepper({ value, step, min, unit, onChange }: { value: number; step: number; min: number; unit: string; onChange: (v: number) => void }) {
  return (
    <Row>
      <Button small variant="secondary" label="−" onPress={() => onChange(Math.max(min, value - step))} />
      <ThemedText type="smallBold">
        {value} {unit}
      </ThemedText>
      <Button small variant="secondary" label="+" onPress={() => onChange(value + step)} />
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
