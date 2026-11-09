import { useEffect } from 'react';

import { useDb, useLiveQuery } from '@/db/hooks';
import { endBreak, finishDueFocus } from '@/features/focus/controller';
import { setJustFinished } from '@/features/focus/phase';
import { getRunningSession, pomodoroEndsAt } from '@/features/focus/repository';
import { getSettings } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { toast } from '@/lib/toast-store';

/** Notices a recent event only: after a long absence (app closed) the state is fixed up silently. */
const FRESH_MS = 2 * 60_000;

/**
 * Global watcher (mounted once): when a Pomodoro runs out it is finished and the "done" state plus a
 * toast appear wherever the user is; when a break ends it is cleared with a toast.
 */
export function FocusWatcher() {
  const db = useDb();
  const now = useNow(1000);
  const running = useLiveQuery((d) => getRunningSession(d), []);
  const breakUntil = useLiveQuery(async (d) => (await getSettings(d)).breakUntil, []) ?? null;
  const endsAt = running ? pomodoroEndsAt(running) : null;

  useEffect(() => {
    if (endsAt == null || now < endsAt) return;
    void finishDueFocus(db).then((s) => {
      if (!s) return;
      if (now - endsAt < FRESH_MS) {
        setJustFinished(true);
        toast('Pomodoro hotové 🎉 Daj si prestávku.');
      }
    });
  }, [db, endsAt, now]);

  useEffect(() => {
    if (breakUntil == null || breakUntil > now) return;
    void endBreak(db).then(() => {
      if (now - breakUntil < FRESH_MS) toast('Prestávka skončila – Späť do práce 💪');
    });
  }, [db, breakUntil, now]);

  return null;
}
