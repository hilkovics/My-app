import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Energy } from '../src/db/types';
import type { Occurrence, OccurrenceKind } from '../src/features/calendar/agenda';
import {
  COMPACT_MAX_MIN,
  PX_PER_HOUR,
  auditBurnout,
  buildDayPlan,
  canAdd,
  findFreeDay,
  heightFor,
  nowAngle,
  sessionArcs,
  shortenOptions,
  sleepAngles,
  type PlanSettings,
} from '../src/features/plan/layout';
import { angleOfPoint, arcPath, hitTestRing, polar, splitAt } from '../src/features/plan/geometry';
import { createItem, setEnergy, setEstimate } from '../src/features/items/repository';
import { expandItems } from '../src/features/calendar/agenda';
import { listTimedItems } from '../src/features/items/repository';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '../src/db/schema';
import type { Db } from '../src/db/types';
import { createMigratedDb, createNodeDb } from './helpers/node-db';
import { getSettings } from '../src/features/settings/repository';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const DAY = at(2026, 11, 10); // Tuesday
const FUTURE_NOW = at(2026, 11, 9, 12); // the day before
const S: PlanSettings = { capacityMinutes: 480, sleepStartHour: 23, sleepEndHour: 7 };

let n = 0;
const occ = (kind: OccurrenceKind, startH: number, minutes: number, extra: Partial<Occurrence> = {}): Occurrence => {
  const start = at(2026, 11, 10, Math.floor(startH), (startH % 1) * 60);
  return {
    key: `k${n++}`,
    kind,
    id: `id${n}`,
    title: `T${n}`,
    start,
    end: start + minutes * 60_000,
    allDay: false,
    color: null,
    done: false,
    recurring: false,
    ...extra,
  };
};
const due = (title: string, estimate: number | null, extra: Partial<Occurrence> = {}): Occurrence =>
  occ('due', 0, 0, { title, allDay: true, start: DAY, end: DAY, estimate, ...extra });
const deep = (h: number, m: number) => occ('block', h, m, { energy: 'deep' as Energy });

describe('proportional size', () => {
  it('is strictly proportional to the duration (15 min = 20 px, 60 min = 80 px)', () => {
    assert.equal(PX_PER_HOUR, 80);
    assert.equal(heightFor(15), 20);
    assert.equal(heightFor(60), 80);
    assert.equal(heightFor(90), 120);
    const plan = buildDayPlan([occ('block', 9, 15), occ('block', 10, 60), occ('block', 12, 90), occ('event', 14, 45)], DAY, S, FUTURE_NOW);
    const heights = plan.entries.map((e) => [e.durationMin, e.dimensions.height]);
    assert.deepEqual(heights, [[15, 20], [60, 80], [90, 120], [45, 60]]);
    const distinct = new Set(plan.entries.map((e) => e.dimensions.height));
    assert.equal(distinct.size, 4, 'different durations never share a height');
  });

  it('draws entries up to 15 minutes as compact strips and stacks them without gaps', () => {
    const plan = buildDayPlan([occ('block', 9, 10), occ('block', 10, 15), occ('block', 11, 60)], DAY, S, FUTURE_NOW);
    assert.deepEqual(plan.entries.map((e) => e.dimensions.compact), [true, true, false]);
    assert.ok(COMPACT_MAX_MIN === 15);
    const [a, b, c] = plan.entries.map((e) => e.dimensions);
    assert.equal(a.top, 0);
    assert.equal(b.top, a.height);
    assert.equal(c.top, a.height + b.height);
    assert.equal(plan.content_height_px, a.height + b.height + c.height);
  });
});

describe('capacity and overload', () => {
  it('counts work only: breaks are free, all-day events are ignored', () => {
    const plan = buildDayPlan(
      [occ('block', 9, 120), occ('block', 12, 30, { energy: 'rest' }), occ('event', 0, 0, { allDay: true, start: DAY, end: DAY + 86_400_000 })],
      DAY,
      S,
      FUTURE_NOW,
    );
    assert.equal(plan.entries.length, 2);
    assert.equal(plan.plannedMinutes, 120);
    assert.equal(plan.remainingMinutes, 360);
    assert.equal(plan.full, false);
  });

  it('marks blocks beyond the capacity and reports the overflow', () => {
    const plan = buildDayPlan([occ('block', 8, 240), occ('block', 12, 180), occ('block', 15, 120)], DAY, S, FUTURE_NOW);
    assert.equal(plan.plannedMinutes, 540);
    assert.equal(plan.overflowMinutes, 60);
    assert.deepEqual(plan.entries.map((e) => e.overflow), [false, false, true], 'the block that crosses the limit overflows');
    assert.equal(plan.remainingMinutes, 0);
    assert.equal(plan.full, true);
    // capacity line: 8 h × 80 px = 640 px from the top of the stack
    assert.equal(plan.capacity_line_px, 640);
  });

  it('puts the capacity line after the empty space when the day is not full', () => {
    const plan = buildDayPlan([occ('block', 9, 60)], DAY, S, FUTURE_NOW);
    assert.equal(plan.capacity_line_px, 640);
    const withBreak = buildDayPlan([occ('block', 9, 60), occ('block', 10, 30, { energy: 'rest' })], DAY, S, FUTURE_NOW);
    assert.equal(withBreak.capacity_line_px, 640 + 40, 'a break takes space in the stack but not capacity');
  });

  it('uses the estimate of a task due that day, or a 30 min guess', () => {
    const plan = buildDayPlan([due('Report', 90), due('Telefonát', null)], DAY, S, FUTURE_NOW);
    const byTitle = Object.fromEntries(plan.entries.map((e) => [e.title, e]));
    assert.deepEqual([byTitle.Report.durationMin, byTitle.Report.guessed], [90, false]);
    assert.deepEqual([byTitle['Telefonát'].durationMin, byTitle['Telefonát'].guessed], [30, true]);
    assert.equal(plan.plannedMinutes, 120);
  });
});

describe('placement on the ring', () => {
  it('maps times to angles (midnight at the top, 15° per hour)', () => {
    const plan = buildDayPlan([occ('event', 6, 60), occ('block', 18, 90)], DAY, S, FUTURE_NOW);
    assert.deepEqual(plan.entries[0].radial_position, { start_angle: 90, end_angle: 105 });
    assert.deepEqual(plan.entries[1].radial_position, { start_angle: 270, end_angle: 292.5 });
  });

  it('places tasks without a time into the first free waking time, skipping blocks and sleep', () => {
    const plan = buildDayPlan([occ('event', 7, 120), due('Úloha', 60)], DAY, S, FUTURE_NOW);
    const task = plan.entries.find((e) => e.title === 'Úloha')!;
    assert.equal(task.tentative, true);
    assert.equal(task.start, at(2026, 11, 10, 9), 'sleep ends at 7, the event holds 7–9');
    assert.deepEqual(task.radial_position, { start_angle: 135, end_angle: 150 });
  });

  it('places higher priority first and leaves a task out when nothing fits', () => {
    const blocker = occ('event', 7, 16 * 60); // 7:00–23:00: the whole waking day
    const plan = buildDayPlan([blocker, due('A', 30, { priority: 3 })], DAY, S, FUTURE_NOW);
    const a = plan.entries.find((e) => e.title === 'A')!;
    assert.equal(a.radial_position, null);
    assert.equal(a.tentative, false);
    assert.equal(plan.freeMinutes, 0);
    assert.equal(plan.full, true);
    const two = buildDayPlan([due('low', 60, { priority: 0 }), due('high', 60, { priority: 2 })], DAY, S, FUTURE_NOW);
    assert.equal(two.entries.find((e) => e.title === 'high')!.start, at(2026, 11, 10, 7));
    assert.equal(two.entries.find((e) => e.title === 'low')!.start, at(2026, 11, 10, 8));
  });

  it('places nothing in the past and only after "now" today', () => {
    const noon = at(2026, 11, 10, 12, 2);
    const today = buildDayPlan([due('Dnes', 30)], DAY, S, noon);
    assert.equal(today.entries[0].start, at(2026, 11, 10, 12, 5), 'rounded up to 5 minutes');
    const past = buildDayPlan([due('Včera', 30)], DAY, S, at(2026, 11, 11, 8));
    assert.equal(past.entries[0].radial_position, null);
    assert.equal(past.freeMinutes, 0);
  });

  it('describes the sleep window, also when it wraps past midnight', () => {
    assert.deepEqual(sleepAngles({ sleepStartHour: 23, sleepEndHour: 7 }), [
      { start_angle: 345, end_angle: 360 },
      { start_angle: 0, end_angle: 105 },
    ]);
    assert.deepEqual(sleepAngles({ sleepStartHour: 1, sleepEndHour: 9 }), [{ start_angle: 15, end_angle: 135 }]);
    assert.deepEqual(sleepAngles({ sleepStartHour: 0, sleepEndHour: 8 }), [{ start_angle: 0, end_angle: 120 }]);
    assert.deepEqual(sleepAngles({ sleepStartHour: 5, sleepEndHour: 5 }), []);
  });

  it('computes the "now" marker and the arcs of real focus work', () => {
    assert.equal(nowAngle(DAY, at(2026, 11, 10, 6)), 90);
    assert.equal(nowAngle(DAY, at(2026, 11, 11, 6)), null);
    const arcs = sessionArcs(
      [
        { startedAt: at(2026, 11, 10, 9), endedAt: at(2026, 11, 10, 10) },
        { startedAt: at(2026, 11, 9, 23), endedAt: at(2026, 11, 10, 1) },
        { startedAt: at(2026, 11, 10, 14), endedAt: null },
      ],
      DAY,
      at(2026, 11, 10, 15),
    );
    assert.deepEqual(arcs, [
      { start_angle: 135, end_angle: 150 },
      { start_angle: 0, end_angle: 15 },
      { start_angle: 210, end_angle: 225 },
    ]);
  });
});

describe('burnout audit', () => {
  it('flags more than two deep blocks in a row without a break', () => {
    const plan = buildDayPlan([deep(9, 60), deep(10, 60), deep(11, 60)], DAY, S, FUTURE_NOW);
    assert.equal(plan.burnout.risk, true);
    assert.deepEqual([plan.burnout.chains[0].deepCount, plan.burnout.chains[0].totalMinutes], [3, 180]);
    assert.equal(plan.burnout.chains[0].start, at(2026, 11, 10, 9));
    assert.equal(plan.burnout.chains[0].end, at(2026, 11, 10, 12));
  });

  it('two deep blocks are fine, and a rest block or a 15 min gap breaks the run', () => {
    assert.equal(buildDayPlan([deep(9, 60), deep(10, 60)], DAY, S, FUTURE_NOW).burnout.risk, false);
    assert.equal(buildDayPlan([deep(9, 60), deep(10, 60), occ('block', 11, 20, { energy: 'rest' }), deep(11.5, 60)], DAY, S, FUTURE_NOW).burnout.risk, false);
    assert.equal(buildDayPlan([deep(9, 60), deep(10, 60), deep(11.25, 60)], DAY, S, FUTURE_NOW).burnout.risk, false, 'exactly 15 min gap is a break');
    assert.equal(buildDayPlan([deep(9, 60), deep(10, 60), deep(11.2, 60)], DAY, S, FUTURE_NOW).burnout.risk, true, '12 min gap is not');
  });

  it('routine blocks between deep ones do not break the run', () => {
    const plan = buildDayPlan([deep(9, 60), occ('block', 10, 30), deep(10.5, 60), deep(11.5, 60)], DAY, S, FUTURE_NOW);
    assert.equal(plan.burnout.risk, true);
    assert.equal(plan.burnout.chains[0].keys.length, 4);
    assert.equal(auditBurnout([]).risk, false);
  });
});

describe('adding to a day', () => {
  it('fits into capacity and free time, breaks always fit', () => {
    const plan = buildDayPlan([occ('block', 8, 420)], DAY, S, FUTURE_NOW); // 7 h of 8 h
    assert.deepEqual(canAdd(plan, 60), { ok: true, reason: null, missingMinutes: 0 });
    assert.deepEqual(canAdd(plan, 90), { ok: false, reason: 'capacity', missingMinutes: 30 });
    assert.equal(canAdd(plan, 90, 'rest').ok, true);
  });

  it('refuses when there is not enough free waking time even if capacity is left', () => {
    const plan = buildDayPlan([occ('event', 7, 15 * 60 + 30)], DAY, { ...S, capacityMinutes: 1200 }, FUTURE_NOW); // 7:00–22:30: 270 min of capacity but only 30 min awake left
    const fit = canAdd(plan, 45);
    assert.deepEqual([fit.ok, fit.reason, fit.missingMinutes], [false, 'time', 15]);
  });

  it('offers to shorten tasks (never events, done tasks or strips) by 15 minutes', () => {
    const plan = buildDayPlan(
      [occ('block', 9, 60, { title: 'Úloha' }), occ('event', 11, 120), occ('block', 14, 15), occ('block', 15, 90, { done: true }), due('Odhad', 40)],
      DAY,
      S,
      FUTURE_NOW,
    );
    assert.deepEqual(
      shortenOptions(plan).map((o) => [o.title, o.durationMin, o.newMinutes]),
      [['Odhad', 40, 25], ['Úloha', 60, 45]], // in the order of the day: the estimated task is placed at 7:00
    );
    const small = buildDayPlan([occ('block', 9, 20)], DAY, S, FUTURE_NOW);
    assert.equal(shortenOptions(small)[0].newMinutes, 15, 'never below 15 min');
  });

  it('finds the next day with room', async () => {
    const full = (d: number) => [occ('block', 8, 480, { start: at(2026, 11, d, 8), end: at(2026, 11, d, 16) })];
    const days: Record<number, Occurrence[]> = { [at(2026, 11, 11)]: full(11), [at(2026, 11, 12)]: full(12) };
    const found = await findFreeDay({
      from: DAY,
      minutes: 60,
      settings: S,
      now: FUTURE_NOW,
      loadOccurrences: async (day) => days[day] ?? [],
    });
    assert.equal(found, at(2026, 11, 13));
    assert.equal(
      await findFreeDay({ from: DAY, minutes: 600, settings: S, now: FUTURE_NOW, maxDays: 3, loadOccurrences: async () => [] }),
      null,
      '10 h never fits an 8 h day',
    );
  });
});

describe('ring geometry', () => {
  it('converts angles to points (top, right, bottom)', () => {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    const top = polar(100, 100, 50, 0);
    const right = polar(100, 100, 50, 90);
    const bottom = polar(100, 100, 50, 180);
    assert.ok(near(top.x, 100) && near(top.y, 50));
    assert.ok(near(right.x, 150) && near(right.y, 100));
    assert.ok(near(bottom.x, 100) && near(bottom.y, 150));
  });

  it('builds arcs with the right large-arc flag; full circles in two halves; empty arcs are empty', () => {
    assert.equal(arcPath(100, 100, 50, 0, 90), 'M 100 50 A 50 50 0 0 1 150 100');
    assert.match(arcPath(100, 100, 50, 0, 270), /A 50 50 0 1 1/);
    assert.equal((arcPath(100, 100, 50, 0, 360).match(/A /g) ?? []).length, 2);
    assert.equal(arcPath(100, 100, 50, 30, 30), '');
  });

  it('splits an arc at "now" into its past and future parts', () => {
    assert.deepEqual(splitAt(10, 50, 30), { past: [10, 30], future: [30, 50] });
    assert.deepEqual(splitAt(10, 50, 5), { past: null, future: [10, 50] });
    assert.deepEqual(splitAt(10, 50, 60), { past: [10, 50], future: null });
    assert.deepEqual(splitAt(10, 50, null), { past: null, future: [10, 50] });
  });
});

describe('ring hit testing', () => {
  const arcs = [
    { key: 'long', start_angle: 80, end_angle: 200 },
    { key: 'short', start_angle: 100, end_angle: 120 },
  ];
  const at = (angle: number, radius: number) => {
    const p = polar(100, 100, radius, angle);
    return { x: p.x, y: p.y };
  };

  it('computes the angle of a point (0 = top, clockwise)', () => {
    assert.ok(Math.abs(angleOfPoint(100, 100, 100, 50) - 0) < 1e-9);
    assert.ok(Math.abs(angleOfPoint(100, 100, 150, 100) - 90) < 1e-9);
    assert.ok(Math.abs(angleOfPoint(100, 100, 100, 150) - 180) < 1e-9);
    assert.ok(Math.abs(angleOfPoint(100, 100, 50, 100) - 270) < 1e-9);
  });

  it('finds the arc under the tap, preferring the shortest of overlapping ones', () => {
    const g = { cx: 100, cy: 100, r: 70, width: 20 };
    assert.equal(hitTestRing(arcs, { ...g, ...at(110, 70) }), 'short');
    assert.equal(hitTestRing(arcs, { ...g, ...at(150, 70) }), 'long');
    assert.equal(hitTestRing(arcs, { ...g, ...at(250, 70) }), null, 'no arc there');
  });

  it('ignores taps that are not on the ring (centre, far outside)', () => {
    const g = { cx: 100, cy: 100, r: 70, width: 20 };
    assert.equal(hitTestRing(arcs, { ...g, ...at(110, 10) }), null);
    assert.equal(hitTestRing(arcs, { ...g, ...at(110, 95) }), null);
    assert.equal(hitTestRing(arcs, { ...g, ...at(110, 84) }), 'short', 'a little slack outside the stroke');
  });
});

describe('estimate and energy are stored', () => {
  it('sets the estimate (a blocked task keeps its start, the end follows) and the energy', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'x', startAt: at(2026, 11, 10, 9), endAt: at(2026, 11, 10, 10) });
    assert.deepEqual([t.estimateMinutes, t.energy], [null, null]);
    const withEstimate = await setEstimate(db, t.id, 90);
    assert.deepEqual([withEstimate.estimateMinutes, withEstimate.startAt, withEstimate.endAt], [90, at(2026, 11, 10, 9), at(2026, 11, 10, 10, 30)]);
    assert.equal((await setEstimate(db, t.id, null)).estimateMinutes, null);
    assert.equal((await setEnergy(db, t.id, 'deep')).energy, 'deep');
    assert.equal((await setEnergy(db, t.id, null)).energy, null);
    const plain = await createItem(db, { type: 'task', title: 'p', dueAt: DAY });
    assert.equal((await setEstimate(db, plain.id, 45)).endAt, null, 'an unblocked task gets no time block');
  });

  it('flows from items through occurrences into the plan', async () => {
    const db = await createMigratedDb();
    await createItem(db, { type: 'task', title: 'Hlboká', dueAt: DAY, estimateMinutes: 120, energy: 'deep', priority: 2 });
    await createItem(db, { type: 'event', title: 'Porada', startAt: at(2026, 11, 10, 10), endAt: at(2026, 11, 10, 11), energy: 'routine' });
    await createItem(db, { type: 'task', title: 'Prestávka', startAt: at(2026, 11, 10, 13), endAt: at(2026, 11, 10, 13, 30), energy: 'rest' });
    const from = DAY;
    const to = DAY + 86_400_000;
    const occs = expandItems(await listTimedItems(db, from, to), from, to);
    const plan = buildDayPlan(occs, DAY, S, FUTURE_NOW);
    const deepTask = plan.entries.find((e) => e.title === 'Hlboká')!;
    assert.deepEqual([deepTask.durationMin, deepTask.energy, deepTask.visual_intensity.border_width], [120, 'deep', 3]);
    assert.equal(plan.entries.find((e) => e.title === 'Prestávka')!.visual_intensity.energy, 'rest');
    assert.equal(plan.plannedMinutes, 180, 'work: 120 + 60, the break is free');
  });

  it('migrates a v5 database and adds the plan settings defaults', async () => {
    const db = createNodeDb();
    await db.execAsync('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS.slice(0, 3)) await db.execAsync(m as string);
    await db.execAsync('PRAGMA user_version = 3');
    await (MIGRATIONS[3] as (d: Db) => Promise<void>)(db);
    await (MIGRATIONS[4] as (d: Db) => Promise<void>)(db);
    await db.execAsync('PRAGMA user_version = 5');
    await db.runAsync("INSERT INTO items (id, type, title, created_at, updated_at) VALUES ('t', 'task', 'stará', 1, 1)");
    await migrate(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
    const row = await db.getFirstAsync<{ estimate_minutes: number | null; energy: string | null }>("SELECT estimate_minutes, energy FROM items WHERE id = 't'");
    assert.deepEqual([row?.estimate_minutes, row?.energy], [null, null]);
    const settings = await getSettings(db);
    assert.deepEqual([settings.dayCapacityMinutes, settings.sleepStartHour, settings.sleepEndHour], [480, 23, 7]);
    await assert.rejects(db.runAsync("UPDATE items SET energy = 'wild' WHERE id = 't'"), 'energy is constrained');
  });
});

describe('entityColor', () => {
  it('prefers the own colour and is stable otherwise', async () => {
    const { entityColor } = await import('../src/features/plan/entity-color');
    const palette = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#888888'];
    assert.equal(entityColor('a', '#123456', palette), '#123456');
    const c1 = entityColor('abc-123', null, palette);
    assert.equal(c1, entityColor('abc-123', undefined, palette));
    assert.ok(palette.includes(c1));
  });
});
