import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportBackup, importBackup } from '../src/features/backup/backup';
import {
  finishDuePomodoro,
  getRunningSession,
  itemFocusMinutes,
  listFocusTags,
  listSessions,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
} from '../src/features/focus/repository';
import {
  bestWindow,
  dailySeries,
  fmtClock,
  fmtMinutes,
  hm,
  goalStreak,
  minutesByDay,
  minutesByHour,
  sessionDuration,
  summarize,
} from '../src/features/focus/stats';
import { createItem, deleteItem } from '../src/features/items/repository';
import { createMigratedDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const MIN = 60_000;
const done = (start: number, minutes: number, pausedMs = 0) => ({
  startedAt: start,
  endedAt: start + minutes * MIN + pausedMs,
  pausedAt: null,
  pausedMs,
});

describe('focus sessions', () => {
  it('starts, pauses, resumes and stops a stopwatch session', async () => {
    const db = await createMigratedDb();
    const t0 = at(2026, 11, 9, 9);
    await startSession(db, { mode: 'stopwatch', tag: '#práca' }, t0);
    await pauseSession(db, t0 + 30 * MIN);
    await resumeSession(db, t0 + 40 * MIN);
    const s = await stopSession(db, t0 + 70 * MIN);
    assert.equal(s?.tag, 'práca');
    assert.equal(sessionDuration(s!), 60 * MIN);
    assert.equal(await getRunningSession(db), null);
  });

  it('allows only one running session; starting another stops the first', async () => {
    const db = await createMigratedDb();
    const t0 = at(2026, 11, 9, 9);
    await startSession(db, { mode: 'stopwatch' }, t0);
    await startSession(db, { mode: 'stopwatch' }, t0 + 20 * MIN);
    const all = await listSessions(db, t0, t0 + 3 * 3600_000);
    assert.equal(all.length, 2);
    assert.equal(all[0].endedAt, t0 + 20 * MIN);
    assert.equal(all[1].endedAt, null);
  });

  it('discards sessions shorter than a minute', async () => {
    const db = await createMigratedDb();
    await startSession(db, { mode: 'stopwatch' }, 1_000_000);
    assert.equal(await stopSession(db, 1_000_000 + 30_000), null);
    assert.equal((await listSessions(db, 0, 2_000_000)).length, 0);
  });

  it('cuts an overrunning Pomodoro at its planned end', async () => {
    const db = await createMigratedDb();
    const t0 = at(2026, 11, 9, 9);
    await startSession(db, { mode: 'pomodoro', plannedMinutes: 25 }, t0);
    assert.equal(await finishDuePomodoro(db, t0 + 10 * MIN), null);
    const s = await finishDuePomodoro(db, t0 + 2 * 3600_000);
    assert.equal(s?.endedAt, t0 + 25 * MIN);
    assert.equal(sessionDuration(s!), 25 * MIN);
  });

  it('a paused Pomodoro ends later by the pause length', async () => {
    const db = await createMigratedDb();
    const t0 = at(2026, 11, 9, 9);
    await startSession(db, { mode: 'pomodoro', plannedMinutes: 25 }, t0);
    await pauseSession(db, t0 + 10 * MIN);
    assert.equal(await finishDuePomodoro(db, t0 + 60 * MIN), null, 'paused pomodoro never auto-finishes');
    await resumeSession(db, t0 + 15 * MIN);
    const s = await finishDuePomodoro(db, t0 + 60 * MIN);
    assert.equal(s?.endedAt, t0 + 30 * MIN);
    assert.equal(sessionDuration(s!), 25 * MIN);
  });

  it('takes the tag from the task and totals time per task', async () => {
    const db = await createMigratedDb();
    const task = await createItem(db, { type: 'task', title: 'report', tags: ['práca'] });
    const t0 = at(2026, 11, 9, 9);
    await startSession(db, { mode: 'stopwatch', itemId: task.id }, t0);
    const s = await stopSession(db, t0 + 50 * MIN);
    assert.equal(s?.tag, 'práca');
    await startSession(db, { mode: 'stopwatch', itemId: task.id, tag: 'iné' }, t0 + 60 * MIN);
    await stopSession(db, t0 + 70 * MIN);
    assert.equal(await itemFocusMinutes(db, task.id), 60);
    // Same count → most recently used first.
    assert.deepEqual(await listFocusTags(db), ['iné', 'práca']);
    // Deleting the task keeps the time (session just loses the link).
    await deleteItem(db, task.id);
    const left = await listSessions(db, t0, t0 + 3 * 3600_000);
    assert.equal(left.length, 2);
    assert.equal(left[0].itemId, null);
  });

  it('round-trips through a backup', async () => {
    const db = await createMigratedDb();
    await startSession(db, { mode: 'stopwatch', tag: 'x' }, at(2026, 11, 9, 9));
    await stopSession(db, at(2026, 11, 9, 10));
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const db2 = await createMigratedDb();
    await importBackup(db2, backup);
    assert.equal((await listSessions(db2, 0, Number.MAX_SAFE_INTEGER)).length, 1);
  });
});

describe('focus stats', () => {
  it('splits a session across midnight by day and hour', () => {
    const s = done(at(2026, 11, 9, 23, 30), 60);
    const byDay = minutesByDay([s]);
    assert.equal(Math.round(byDay.get('2026-11-09')!), 30);
    assert.equal(Math.round(byDay.get('2026-11-10')!), 30);
    const byHour = minutesByHour([s]);
    assert.equal(Math.round(byHour[23]), 30);
    assert.equal(Math.round(byHour[0]), 30);
  });

  it('spreads pauses proportionally', () => {
    // 2h wall clock, 1h paused → 60 worked minutes over 9:00–11:00
    const byHour = minutesByHour([done(at(2026, 11, 9, 9), 60, 60 * MIN)]);
    assert.equal(Math.round(byHour[9]), 30);
    assert.equal(Math.round(byHour[10]), 30);
  });

  it('counts a running session up to now, excluding an open pause', () => {
    const s = { startedAt: 0, endedAt: null, pausedAt: 40 * MIN, pausedMs: 5 * MIN };
    assert.equal(sessionDuration(s, 60 * MIN), 35 * MIN);
  });

  it('computes goal streak, summary and best window', () => {
    const today = at(2026, 11, 12, 15);
    const byDay = new Map([
      ['2026-11-09', 200],
      ['2026-11-10', 180],
      ['2026-11-11', 190],
      ['2026-11-12', 60],
    ]);
    assert.equal(goalStreak(byDay, 180, today), 3, 'today not reached yet: counts from yesterday');
    byDay.set('2026-11-12', 180);
    assert.equal(goalStreak(byDay, 180, today), 4);
    byDay.set('2026-11-10', 100);
    assert.equal(goalStreak(byDay, 180, today), 2);

    const series = dailySeries(byDay, at(2026, 11, 9), 7);
    assert.equal(series.length, 7);
    const sum = summarize(series, 180, today);
    assert.equal(sum.totalMinutes, 200 + 100 + 190 + 180);
    assert.equal(sum.avgMinutes, (200 + 100 + 190 + 180) / 4);
    assert.equal(sum.best?.minutes, 200);
    assert.equal(sum.daysWithGoal, 3);

    const byHour = new Array(24).fill(0);
    byHour[9] = 40;
    byHour[10] = 50;
    byHour[15] = 60;
    assert.deepEqual(bestWindow(byHour), [9, 11]);
    assert.equal(bestWindow(new Array(24).fill(0)), null);
  });

  it('formats durations', () => {
    assert.equal(fmtMinutes(45), '45\u00a0min');
    assert.equal(fmtMinutes(125), '2\u00a0h\u00a05\u00a0min');
    assert.equal(fmtMinutes(75), '1\u00a0h\u00a015\u00a0min');
    assert.equal(fmtMinutes(120), '2\u00a0h');
    assert.equal(fmtMinutes(0), '0\u00a0min');
    assert.equal(hm(405), '6:45');
    assert.equal(hm(0), '0:00');
    assert.equal(fmtClock(25 * MIN), '25:00');
    assert.equal(fmtClock(3600_000 + 5 * MIN + 9_000), '1:05:09');
  });
});
