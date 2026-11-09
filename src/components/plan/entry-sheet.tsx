import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { startFocus } from '@/features/focus/controller';
import { fmtMinutes } from '@/features/focus/stats';
import { getItem, setEnergy, setEstimate } from '@/features/items/repository';
import type { PlanEntry } from '@/features/plan/layout';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtTime } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { Button, Field, Row } from '../ui';
import { ENERGY_ICON } from './energy-style';
import { EnergyChips, EstimateChips } from './estimate-chips';

/** Bottom sheet for one block of the day: how demanding, estimate, start focus, open. */
export function EntrySheet({ entry, onClose }: { entry: PlanEntry | null; onClose: () => void }) {
  const db = useDb();
  const theme = useTheme();
  const local = entry != null && entry.kind !== 'external';
  const item = useLiveQuery((d) => (entry && local ? getItem(d, entry.id) : Promise.resolve(null)), [entry?.id ?? null, local]);
  const isTask = entry != null && (entry.kind === 'block' || entry.kind === 'due');

  const focus = async () => {
    if (!entry) return;
    await startFocus(db, { mode: 'pomodoro', plannedMinutes: Math.max(1, Math.min(180, Math.round(entry.durationMin))), itemId: entry.id });
    onClose();
  };

  return (
    <Modal visible={entry != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.board.cancel}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={() => {}}>
          {entry ? (
            <>
              <ThemedText type="smallBold" numberOfLines={2}>
                {ENERGY_ICON[entry.energy] ? `${ENERGY_ICON[entry.energy]} ` : ''}
                {entry.title || t.common.untitled}
              </ThemedText>
              <ThemedText type="small" themeColor="text2">
                {entry.start != null ? `${fmtTime(entry.start)}–${fmtTime(entry.start + entry.durationMin * 60_000)} · ` : ''}
                {entry.guessed ? '~' : ''}
                {fmtMinutes(entry.durationMin)}
                {entry.guessed ? ` (${t.plan.guessed})` : ''}
                {entry.tentative ? ` · ${t.plan.tentative}` : ''}
                {entry.overflow ? ` · ⚠ ${t.plan.over}` : ''}
              </ThemedText>

              {local && item ? (
                <>
                  <Field label={t.plan.energy}>
                    <EnergyChips value={item.energy} onChange={(e) => void setEnergy(db, item.id, e)} />
                  </Field>
                  {isTask ? (
                    <Field label={t.plan.estimate}>
                      <EstimateChips value={item.estimateMinutes} onChange={(m) => void setEstimate(db, item.id, m)} />
                    </Field>
                  ) : null}
                </>
              ) : !local ? (
                <ThemedText type="small" themeColor="text2">
                  Udalosť z kalendára v telefóne sa tu len zobrazuje.
                </ThemedText>
              ) : null}

              <Row>
                {local && entry.energy !== 'rest' && !entry.done ? <Button small icon="play" label={t.plan.startFocus} onPress={() => void focus()} /> : null}
                {local ? (
                  <Button
                    small
                    variant="secondary"
                    label={t.plan.open}
                    onPress={() => {
                      onClose();
                      router.push({ pathname: '/item/[id]', params: { id: entry.id } });
                    }}
                  />
                ) : null}
                <Button small variant="ghost" label={t.board.cancel} onPress={onClose} />
              </Row>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end', padding: Spacing.three },
  sheet: { borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: 520, alignSelf: 'center' },
});
