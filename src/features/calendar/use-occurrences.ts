import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useLiveQuery } from '@/db/hooks';
import { eventRefFromOccurrence, listNotedOccurrenceKeys, occurrenceNoteKey } from '@/features/items/event-notes';
import { listTimedItems } from '@/features/items/repository';
import { getSettings } from '@/features/settings/repository';

import { expandItems, sortOccurrences, type Occurrence } from './agenda';
import { fetchDeviceOccurrences } from './device';

/** Local + phone-calendar occurrences in [from, to), kept up to date. */
export function useOccurrences(from: number, to: number): Occurrence[] {
  const local = useLiveQuery(async (db) => expandItems(await listTimedItems(db, from, to), from, to), [from, to]);
  const settings = useLiveQuery((db) => getSettings(db), []);
  const noted = useLiveQuery((db) => listNotedOccurrenceKeys(db, from, to), [from, to]);
  const [external, setExternal] = useState<Occurrence[]>([]);
  const [tick, setTick] = useState(0);
  const ids = settings?.deviceCalendarIds.join(',') ?? '';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((n) => n + 1));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    fetchDeviceOccurrences(ids ? ids.split(',') : [], from, to)
      .then((list) => alive && setExternal(list))
      .catch((e) => {
        console.warn('device calendar', e);
        if (alive) setExternal([]);
      });
    return () => {
      alive = false;
    };
  }, [ids, from, to, tick]);

  return sortOccurrences(
    [...(local ?? []), ...external].map((o) => {
      const ref = eventRefFromOccurrence(o);
      const hasNote = !!ref && !!noted?.has(occurrenceNoteKey(ref.source, ref.eventId, ref.occurrenceStart));
      return hasNote ? { ...o, hasNote } : o;
    }),
  );
}
