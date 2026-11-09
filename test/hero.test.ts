import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Occurrence } from '../src/features/calendar/agenda';
import { burnoutNote, currentEntry, heroCopy, nowFraction, stripBlocks } from '../src/features/plan/hero';
import { buildDayPlan, type PlanSettings } from '../src/features/plan/layout';
import { fmtDatePill, fmtTime } from '../src/lib/dates';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const DAY = at(2026, 11, 10);
const S: PlanSettings = { capacityMinutes: 480, sleepStartHour: 23, sleepEndHour: 7 };
const NB = ' ';

let n = 0;
const block = (startH: number, minutes: number, energy: Occurrence['energy'] = 'deep', kind: Occurrence['kind'] = 'block'): Occurrence => {
  const start = at(2026, 11, 10, Math.floor(startH), (startH % 1) * 60);
  n += 1;
  return {
    key: `k${n}`,
    kind,
    id: `id${n}`,
    title: `T${n}`,
    start,
    end: start + minutes * 60_000,
    allDay: false,
    color: null,
    done: false,
    recurring: false,
    estimate: minutes,
    energy,
  };
};

describe('heroCopy', () => {
  it('free time left, exactly full, over capacity', () => {
    const free = heroCopy({ overflowMinutes: 0, remainingMinutes: 75, full: false });
    assert.equal(free.state, 'free');
    assert.equal(free.headline, `Dobré tempo. Ešte 1${NB}h${NB}15${NB}min a deň je plný.`);
    const full = heroCopy({ overflowMinutes: 0, remainingMinutes: 0, full: true });
    assert.equal(full.state, 'full');
    assert.equal(full.headline, 'Deň je plný. Zvládneš to, krok po kroku.');
    const over = heroCopy({ overflowMinutes: 45, remainingMinutes: 0, full: true });
    assert.equal(over.state, 'over');
    assert.equal(over.headline, `Dnes je toho veľa. Skús presunúť 45${NB}min.`);
  });
});

describe('day strip', () => {
  const plan = buildDayPlan([block(9, 120), block(11, 90, 'routine'), block(13, 60, 'rest'), block(15, 60, 'deep', 'event')], DAY, S, at(2026, 11, 10, 12));

  it('positions blocks as fractions of 7:00–23:00 and marks the past ones', () => {
    const blocks = stripBlocks(plan.entries, at(2026, 11, 10, 12));
    const first = blocks.find((b) => b.kind === 'deep')!;
    assert.ok(Math.abs(first.left - 2 / 16) < 1e-9, '9:00 is 2 h into the strip');
    assert.ok(Math.abs(first.width - 2 / 16) < 1e-9, '2 h wide');
    assert.equal(first.past, true);
    const kinds = blocks.map((b) => b.kind).sort();
    assert.deepEqual(kinds, ['deep', 'event', 'pause', 'routine']);
    assert.equal(blocks.find((b) => b.kind === 'event')!.past, false);
  });

  it('now marker is null outside the strip', () => {
    assert.equal(nowFraction(at(2026, 11, 10, 7)), 0);
    assert.equal(nowFraction(at(2026, 11, 10, 23)), 1);
    assert.equal(nowFraction(at(2026, 11, 10, 6, 59)), null);
    assert.equal(nowFraction(at(2026, 11, 10, 23, 30)), null);
    assert.ok(Math.abs(nowFraction(at(2026, 11, 10, 15))! - 0.5) < 1e-9);
  });

  it('clips blocks that stick out of the window', () => {
    const early = buildDayPlan([block(6, 120, 'deep', 'event')], DAY, S);
    const [b] = stripBlocks(early.entries, null);
    assert.equal(b.left, 0);
    assert.ok(Math.abs(b.width - 1 / 16) < 1e-9, 'only 7:00–8:00 is inside');
  });

  it('currentEntry finds the running block', () => {
    assert.equal(currentEntry(plan.entries, at(2026, 11, 10, 10))?.start, at(2026, 11, 10, 9));
    assert.equal(currentEntry(plan.entries, at(2026, 11, 10, 8)), null);
  });
});

describe('burnout note', () => {
  it('only with three deep blocks in a row', () => {
    const risky = buildDayPlan([block(9, 90), block(10.5, 90), block(12, 90)], DAY, S);
    assert.equal(burnoutNote(risky, fmtTime), 'Riziko vyčerpania – po 13:30 si daj pauzu.');
    const calm = buildDayPlan([block(9, 90), block(10.5, 90)], DAY, S);
    assert.equal(burnoutNote(calm, fmtTime), null);
  });
});

describe('date pill', () => {
  it('formats the weekday and date in capitals', () => {
    assert.equal(fmtDatePill(at(2026, 11, 10, 11)), 'UTOROK · 10. 11.');
  });
});
