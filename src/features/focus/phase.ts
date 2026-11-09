// Which of the five Fokus states is on: idle, running, paused, break, or done (Pomodoro just ended).
import { useSyncExternalStore } from 'react';

export type FocusPhase = 'idle' | 'running' | 'paused' | 'break' | 'done';

export function focusPhase(input: {
  running: { pausedAt: number | null } | null;
  breakUntil: number | null;
  now: number;
  justFinished: boolean;
}): FocusPhase {
  if (input.running) return input.running.pausedAt != null ? 'paused' : 'running';
  if (input.breakUntil != null && input.breakUntil > input.now) return 'break';
  return input.justFinished ? 'done' : 'idle';
}

/** The hero zone (accent) is shown in every state except idle. */
export const isHeroPhase = (p: FocusPhase): boolean => p !== 'idle';

/** "Ešte 1 h 15 min a máš denný cieľ fokusu." / goal reached message. */
export function pepLine(todayMinutes: number, goalMinutes: number, fmt: (m: number) => string): string {
  return todayMinutes >= goalMinutes
    ? 'Denný cieľ fokusu splnený. Výborne!'
    : `Ešte ${fmt(goalMinutes - todayMinutes)} a máš denný cieľ fokusu.`;
}

// In-memory flag: a Pomodoro ended and the "done" state waits for a choice (break / next).
let finished = false;
const listeners = new Set<() => void>();

export function setJustFinished(v: boolean): void {
  if (finished === v) return;
  finished = v;
  listeners.forEach((l) => l());
}

export function useJustFinished(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => finished,
    () => finished,
  );
}
