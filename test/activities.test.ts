import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportBackup, importBackup } from '../src/features/backup/backup';
import {
  addManualLog,
  createActivity,
  getRunningActivity,
  listActivities,
  listLogs,
  listRecentLogs,
  logCheck,
  logDuration,
  pauseActivity,
  resumeActivity,
  startActivity,
  stopActivity,
  updateLog,
  type Activity,
  type ActivityLog,
} from '../src/features/activities/repository';
import {
  activitiesPerDay,
  completionRate,
  dayStreak,
  dayValues,
  fmtDistance,
  fmtGoal,
  fmtPace,
  heatLevel,
  heatScale,
  recentWeekStarts,
  weekStreak,
  weekValue,
  weeklyMix,
  yearGrid,
} from '../src/features/activities/stats';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '../src/db/schema';
import { plural, weekdayIndex, ymd } from '../src/lib/dates';
import { createMigratedDb, createNodeDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const MIN = 60_000;
// Monday 9 Nov 2026, 18:00
const NOW = at(2026, 11, 9, 18);

const activity = (over: Partial<Activity>): Activity => ({
  id: 'a',
  name: 'A',
  icon: '⭐',
  colorSlot: 0,
  kind: 'timed',
  trackDistance: false,
  trackRating: false,
  days: '1111111',
  targetPerDay: 1,
  goalType: null,
  goalValue: null,
  archived: false,
  position: 0,
  createdAt: at(2026, 1, 1),
  ...over,
});

const log = (activityId: string, day: string, minutes: number, extra: Partial<ActivityLog> = {}): ActivityLog => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d, 10).getTime();
  return {
    id: `${activityId}-${day}-${minutes}`,
    activityId,
    day,
    startedAt: t,
    endedAt: t + minutes * MIN,
    pausedAt: null,
    pausedMs: 0,
    durationMs: minutes * MIN,
    distanceM: null,
    count: 0,
    rating: null,
    note: '',
    createdAt: t,
    ...extra,
  };
};

describe('migration v3 → v4 (habits become activities)', () => {
  it('moves habits and their logs into activities', async () => {
    const db = createNodeDb();
    await db.execAsync('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS.slice(0, 3)) await db.execAsync(m as string);
    await db.execAsync('PRAGMA user_version = 3');
    await db.runAsync(
      "INSERT INTO habits (id, name, icon, color, days, target_per_day, archived, created_at) VALUES ('h1', 'Voda', '💧', '#000', '1111100', 8, 0, 1)",
    );
    await db.runAsync("INSERT INTO habit_logs (habit_id, date, count) VALUES ('h1', '2026-11-05', 8), ('h1', '2026-11-06', 3)");
    await migrate(db);

    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
    const [voda] = await listActivities(db);
    assert.equal(voda.id, 'h1');
    assert.equal(voda.kind, 'check');
    assert.equal(voda.targetPerDay, 8);
    assert.equal(voda.days, '1111100');
    const logs = await listLogs(db, '2026-11-01', '2026-11-30');
    assert.deepEqual(
      logs.map((l) => [l.day, l.count, l.startedAt]),
      [
        ['2026-11-05', 8, at(2026, 11, 5)],
        ['2026-11-06', 3, at(2026, 11, 6)],
      ],
    );
    const old = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name IN ('habits', 'habit_logs')");
    assert.equal(old.length, 0);
  });

  it('converts habits from an older backup', async () => {
    const db = await createMigratedDb();
    await importBackup(db, {
      app: 'planovac',
      schemaVersion: 3,
      exportedAt: 0,
      tables: {
        habits: [{ id: 'h1', name: 'Čítanie', icon: '📚', color: '#000', days: '1111111', target_per_day: 1, archived: 0, created_at: 1 }],
        habit_logs: [{ habit_id: 'h1', date: '2026-11-02', count: 1 }],
      },
    });
    const [a] = await listActivities(db);
    assert.equal(a.name, 'Čítanie');
    assert.equal((await listLogs(db, '2026-11-01', '2026-11-30')).length, 1);
  });
});

describe('activities repository', () => {
  it('times a session with a pause; only one timer runs', async () => {
    const db = await createMigratedDb();
    const guitar = await createActivity(db, { name: 'Gitara', kind: 'timed', trackRating: true });
    const run = await createActivity(db, { name: 'Beh', kind: 'timed', trackDistance: true });
    assert.equal(run.colorSlot, 1, 'colours are assigned in creation order');
    await startActivity(db, guitar.id, NOW);
    await pauseActivity(db, NOW + 20 * MIN);
    await resumeActivity(db, NOW + 25 * MIN);
    await startActivity(db, run.id, NOW + 45 * MIN); // stops the guitar timer
    const logs = await listLogs(db, '2026-11-09', '2026-11-09');
    assert.equal(logs.length, 2);
    assert.equal(logDuration(logs[0]), 40 * MIN);
    assert.equal((await getRunningActivity(db))?.activityId, run.id);
    assert.equal(await stopActivity(db, NOW + 45 * MIN + 20_000), null, 'under a minute is discarded');
    assert.equal(await getRunningActivity(db), null);
  });

  it('adds and edits manual entries; pace for runs', async () => {
    const db = await createMigratedDb();
    const run = await createActivity(db, { name: 'Beh', kind: 'timed', trackDistance: true });
    const l = await addManualLog(db, { activityId: run.id, startedAt: at(2026, 11, 8, 7), minutes: 28, distanceKm: 5.2, note: 'okolo jazera' });
    assert.equal(l.day, '2026-11-08');
    assert.equal(fmtPace(logDuration(l), l.distanceM!), '5:23 /km');
    await updateLog(db, l.id, { minutes: 26, rating: 4 });
    const [edited] = await listRecentLogs(db, run.id);
    assert.equal(logDuration(edited), 26 * MIN);
    assert.equal(edited.rating, 4);
    assert.equal(edited.distanceM, 5200);
    assert.equal(fmtDistance(5200), '5,2 km');
    assert.equal(fmtDistance(12345), '12,3 km');
  });

  it('ticks check activities per day', async () => {
    const db = await createMigratedDb();
    const water = await createActivity(db, { name: 'Voda', kind: 'check', targetPerDay: 2 });
    await logCheck(db, water.id, '2026-11-09', 1);
    await logCheck(db, water.id, '2026-11-09', 1);
    await logCheck(db, water.id, '2026-11-08', 1);
    await logCheck(db, water.id, '2026-11-08', -3);
    const logs = await listLogs(db, '2026-11-01', '2026-11-30', water.id);
    assert.deepEqual(
      logs.map((l) => [l.day, l.count]),
      [['2026-11-09', 2]],
    );
  });

  it('round-trips activities through a backup', async () => {
    const db = await createMigratedDb();
    const g = await createActivity(db, { name: 'Gitara', kind: 'timed' });
    await addManualLog(db, { activityId: g.id, startedAt: NOW, minutes: 30 });
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const db2 = await createMigratedDb();
    await importBackup(db2, backup);
    assert.equal((await listRecentLogs(db2, g.id)).length, 1);
  });
});

describe('activity stats', () => {
  const guitar = activity({ id: 'g', name: 'Gitara', goalType: 'sessions', goalValue: 3 });
  const run = activity({ id: 'r', name: 'Beh', colorSlot: 1, trackDistance: true, goalType: 'km', goalValue: 10 });
  const water = activity({ id: 'w', name: 'Voda', kind: 'check', targetPerDay: 2, colorSlot: 2 });

  it('computes day values and the overall "activities per day"', () => {
    const logs = [
      log('g', '2026-11-09', 30),
      log('g', '2026-11-09', 15),
      log('r', '2026-11-09', 28),
      log('w', '2026-11-09', 0, { count: 2, durationMs: null }),
      log('w', '2026-11-08', 0, { count: 1, durationMs: null }),
    ];
    assert.equal(dayValues(logs.filter((l) => l.activityId === 'g'), guitar).get('2026-11-09'), 45);
    assert.equal(dayValues(logs.filter((l) => l.activityId === 'w'), water).get('2026-11-08'), 1);
    const perDay = activitiesPerDay(logs, [guitar, run, water]);
    assert.equal(perDay.get('2026-11-09'), 3);
    assert.equal(perDay.get('2026-11-08'), undefined, 'water below its daily target does not count');
  });

  it('maps values to 5 heat levels', () => {
    assert.equal(heatScale([], 8), 8);
    assert.equal(heatScale([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]), 100);
    assert.equal(heatLevel(0, 60), 0);
    assert.equal(heatLevel(1, 60), 1);
    assert.equal(heatLevel(30, 60), 2);
    assert.equal(heatLevel(999, 60), 4);
  });

  it('builds a 53×7 year grid starting on Monday and ending with this week', () => {
    const grid = yearGrid(NOW);
    assert.equal(grid.length, 53);
    assert.ok(grid.every((w) => w.length === 7 && weekdayIndex(w[0]) === 0));
    assert.ok(grid[52].some((d) => ymd(d) === '2026-11-09'));
  });

  it('builds the weekly mix in activity order and folds extras into "Ostatné"', () => {
    const weeks = recentWeekStarts(NOW, 2); // 2.11. and 9.11.
    const mix = weeklyMix([log('r', '2026-11-03', 30), log('g', '2026-11-09', 45), log('w', '2026-11-09', 0, { count: 3 })], [guitar, run, water], weeks);
    assert.deepEqual(
      mix.series.map((s) => s.key),
      ['g', 'r'],
    );
    assert.deepEqual(mix.values, [
      [0, 30],
      [45, 0],
    ]);
    const many = Array.from({ length: 10 }, (_, i) => activity({ id: `x${i}`, name: `X${i}`, colorSlot: i % 8 }));
    const logs = many.map((a, i) => log(a.id, '2026-11-09', 10 + i));
    const folded = weeklyMix(logs, many, weeks);
    assert.equal(folded.series.length, 8);
    assert.equal(folded.series[7].name, 'Ostatné');
    assert.equal(folded.values[1][7], 10 + 11 + 12, '7 largest kept, the three smallest folded');
  });

  it('tracks weekly goals and streaks in sessions, km and minutes', () => {
    const logs = [
      // week of 26.10.: 3 sessions, 12 km
      log('g', '2026-10-26', 20),
      log('g', '2026-10-28', 20),
      log('g', '2026-10-30', 20),
      log('r', '2026-10-27', 30, { distanceM: 6000 }),
      log('r', '2026-10-29', 30, { distanceM: 6000 }),
      // week of 2.11.: 3 sessions, 8 km
      log('g', '2026-11-02', 20),
      log('g', '2026-11-04', 20),
      log('g', '2026-11-06', 20),
      log('r', '2026-11-03', 40, { distanceM: 8000 }),
      // this week (9.11.): 1 session
      log('g', '2026-11-09', 20),
    ];
    const thisWeek = recentWeekStarts(NOW, 1)[0];
    assert.equal(weekValue(guitar, logs, thisWeek, NOW), 1);
    assert.equal(fmtGoal(guitar, 1), '1/3×');
    assert.equal(weekStreak(guitar, logs, NOW), 2, 'current week not met yet: counts the previous two');
    assert.equal(weekStreak(run, logs, NOW), 0, 'last week only 8 of 10 km');
    const minutes = { ...guitar, goalType: 'minutes' as const, goalValue: 60 };
    assert.equal(weekValue(minutes, logs, thisWeek, NOW), 20);
    assert.equal(fmtGoal(run, 8), '8/10 km');
  });

  it('uses Slovak plural forms', () => {
    assert.equal(plural(1, 'deň', 'dni', 'dní'), '1 deň');
    assert.equal(plural(3, 'deň', 'dni', 'dní'), '3 dni');
    assert.equal(plural(0, 'týždeň', 'týždne', 'týždňov'), '0 týždňov');
  });

  it('keeps habit-style streaks for check activities', () => {
    const counts = new Map([
      ['2026-11-07', 2],
      ['2026-11-08', 2],
    ]);
    assert.equal(dayStreak(water, counts, NOW), 2, 'today not done yet');
    assert.equal(Math.round(completionRate(water, counts, 3, NOW) * 100), 67);
  });
});
