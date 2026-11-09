import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import type { Energy, Item, ItemInput } from '@/db/types';
import { fmtMinutes } from '@/features/focus/stats';
import { createItem, setAlerts, setEstimate } from '@/features/items/repository';
import { loadDayOccurrences, planSettingsOf } from '@/features/plan/data';
import { DEFAULT_ESTIMATE_MIN, buildDayPlan, canAdd, findFreeDay, shortenOptions } from '@/features/plan/layout';
import { getSettings } from '@/features/settings/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { toast } from '@/lib/toast-store';
import { DAY, addDays, fmtDateLong, fmtDateLongAcc, startOfDay } from '@/lib/dates';

import { BottomSheet } from '../bottom-sheet';
import { ThemedText } from '../themed-text';
import { Button, Row } from '../ui';

export interface GuardRequest {
  /** Day the entry is about to be added to. */
  day: number;
  /** Duration of the new entry. */
  minutes: number;
  energy?: Energy | null;
  /** The entry itself, if it is already part of that day (so it isn't counted twice). */
  excludeId?: string;
  /** Does the adding, on the given day (the requested one, or the one it was moved to). */
  proceed: (day: number) => Promise<void> | void;
}

/**
 * "A full day can't take another task unless one is shortened or moved."
 * `guard(request)` adds right away when the day has room, otherwise shows a dialog offering to
 * shorten another task, move to the next free day, or add anyway. Events are never blocked by this.
 * Render `dialog` somewhere in the screen.
 */
export function useCapacityGuard(): { guard: (r: GuardRequest) => Promise<void>; dialog: ReactNode } {
  const db = useDb();
  const [pending, setPending] = useState<GuardRequest | null>(null);

  const guard = useCallback(
    async (r: GuardRequest) => {
      const settings = await getSettings(db);
      const occurrences = await loadDayOccurrences(db, r.day, settings.deviceCalendarIds);
      const plan = buildDayPlan(
        r.excludeId ? occurrences.filter((o) => o.id !== r.excludeId) : occurrences,
        r.day,
        planSettingsOf(settings),
      );
      if (canAdd(plan, r.minutes, r.energy).ok) await r.proceed(r.day);
      else setPending(r);
    },
    [db],
  );

  const dialog = pending ? (
    <CapacityDialog
      request={pending}
      onClose={() => setPending(null)}
      onProceed={(day) => {
        setPending(null);
        void pending.proceed(day);
      }}
    />
  ) : null;
  return { guard, dialog };
}

function CapacityDialog({ request: r, onClose, onProceed }: { request: GuardRequest; onClose: () => void; onProceed: (day: number) => void }) {
  const db = useDb();
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const view = useLiveQuery(
    async (d) => {
      const settings = await getSettings(d);
      const ps = planSettingsOf(settings);
      const occ = await loadDayOccurrences(d, r.day, settings.deviceCalendarIds);
      const plan = buildDayPlan(r.excludeId ? occ.filter((o) => o.id !== r.excludeId) : occ, r.day, ps);
      const freeDay = await findFreeDay({
        from: r.day,
        minutes: r.minutes,
        energy: r.energy,
        settings: ps,
        loadOccurrences: (day) => loadDayOccurrences(d, day, settings.deviceCalendarIds),
      });
      return { plan, freeDay };
    },
    [r.day, r.minutes, r.energy ?? null, r.excludeId ?? null],
  );
  const fits = view ? canAdd(view.plan, r.minutes, r.energy).ok : false;
  const options = view ? shortenOptions(view.plan) : [];

  const overBy = view ? Math.max(0, view.plan.plannedMinutes + r.minutes - view.plan.capacityMinutes) : 0;
  const addAnyway = () => {
    onProceed(r.day);
    if (overBy > 0) toast(`⚠ Deň je plný – +${fmtMinutes(overBy)} nad kapacitu`);
  };

  return (
    <BottomSheet visible onClose={onClose} title={`${t.plan.dialog.title} · ${fmtDateLong(r.day)}`} closeLabel={t.plan.dialog.cancel}>
      {view ? (
        <ThemedText type="bodySmall" themeColor="text2">
          {t.plan.remaining} {fmtMinutes(view.plan.remainingMinutes)} · {fmtMinutes(view.plan.freeMinutes)} {t.plan.free} · pridávaš {fmtMinutes(r.minutes)}
        </ThemedText>
      ) : null}

      {options.length ? (
        <View style={styles.optionsBox}>
          <ThemedText type="bodySmall" themeColor="text2" style={{ fontFamily: FontFamily[800] }}>
            {t.plan.dialog.shorten}
          </ThemedText>
          {options.map((o) => (
            <Row key={o.key} style={styles.optionRow}>
              <ThemedText type="bodySmall" numberOfLines={1} style={styles.flex}>
                {o.title} · {fmtMinutes(o.durationMin)}
              </ThemedText>
              <Button
                small
                variant="secondary"
                label={`→ ${fmtMinutes(o.newMinutes)}`}
                disabled={busy === o.key}
                onPress={() => {
                  setBusy(o.key);
                  void setEstimate(db, o.id, o.newMinutes).finally(() => setBusy(null));
                }}
              />
            </Row>
          ))}
        </View>
      ) : null}

      {fits ? (
        <ThemedText type="bodySmall" style={{ color: theme.success, fontFamily: FontFamily[700] }}>
          {t.plan.dialog.fits}
        </ThemedText>
      ) : null}

      <Row style={styles.actions}>
        {fits ? <Button small label={t.plan.dialog.add} onPress={() => onProceed(r.day)} /> : null}
        {view?.freeDay != null ? (
          <Button small variant="secondary" label={`${t.plan.dialog.moveTo} ${fmtDateLongAcc(view.freeDay)}`} onPress={() => onProceed(view.freeDay!)} />
        ) : view ? (
          <ThemedText type="bodySmall" themeColor="text2">
            {t.plan.dialog.noFreeDay}
          </ThemedText>
        ) : null}
        {!fits ? <Button small variant="secondary" label={t.plan.dialog.addAnyway} onPress={addAnyway} /> : null}
        <Button small variant="ghost" label={t.plan.dialog.cancel} onPress={onClose} />
      </Row>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  optionsBox: { gap: Spacing.one },
  optionRow: { flexWrap: 'nowrap', justifyContent: 'space-between', paddingVertical: 2 },
  actions: { justifyContent: 'flex-end' },
});

/** The new task moved by whole days (keeps times of day). */
export function shiftInput(input: ItemInput, days: number): ItemInput {
  if (!days) return input;
  const sh = (v: number | null | undefined) => (v == null ? v : addDays(v, days));
  return { ...input, startAt: sh(input.startAt), endAt: sh(input.endAt), dueAt: sh(input.dueAt) };
}

/**
 * Creates an item; a task with a date or time block first goes through the capacity guard, so a
 * full day can't silently take one more task. Render `dialog` in the screen.
 */
export function useGuardedCreate() {
  const db = useDb();
  const { guard, dialog } = useCapacityGuard();
  const create = useCallback(
    async (input: ItemInput, opts: { alerts?: number[]; onCreated?: (item: Item) => void | Promise<void> } = {}) => {
      const make = async (days: number) => {
        const item = await createItem(db, shiftInput(input, days));
        if (opts.alerts?.length) await setAlerts(db, item.id, opts.alerts);
        await opts.onCreated?.(item);
      };
      const anchor = input.type === 'task' ? (input.startAt ?? input.dueAt ?? null) : null;
      if (anchor == null) return make(0);
      const day = startOfDay(anchor);
      await guard({
        day,
        minutes: input.estimateMinutes ?? DEFAULT_ESTIMATE_MIN,
        energy: input.energy ?? null,
        proceed: (d) => make(Math.round((d - day) / DAY)),
      });
    },
    [db, guard],
  );
  return { create, dialog };
}
