import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describeRule,
  formatRule,
  nextOccurrence,
  occurrencesBetween,
  parseRule,
} from '../src/lib/recurrence';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

describe('recurrence', () => {
  it('round-trips rules', () => {
    const r = parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5')!;
    assert.deepEqual(r, { freq: 'WEEKLY', interval: 2, byDay: [0, 2], count: 5 });
    assert.equal(formatRule(r), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5');
    assert.equal(parseRule('FREQ=HOURLY'), null);
    assert.equal(parseRule(null), null);
  });

  it('expands daily occurrences in a range', () => {
    const start = at(2026, 11, 1, 8, 30);
    const occ = occurrencesBetween(start, parseRule('FREQ=DAILY'), at(2026, 11, 3), at(2026, 11, 6));
    assert.deepEqual(occ, [at(2026, 11, 3, 8, 30), at(2026, 11, 4, 8, 30), at(2026, 11, 5, 8, 30)]);
  });

  it('expands weekly BYDAY and skips days before dtstart', () => {
    // 2026-11-04 is a Wednesday
    const start = at(2026, 11, 4, 18);
    const occ = occurrencesBetween(start, parseRule('FREQ=WEEKLY;BYDAY=MO,WE,FR'), at(2026, 11, 1), at(2026, 11, 10));
    assert.deepEqual(occ, [at(2026, 11, 4, 18), at(2026, 11, 6, 18), at(2026, 11, 9, 18)]);
  });

  it('skips months without the day', () => {
    const start = at(2026, 1, 31, 10);
    const occ = occurrencesBetween(start, parseRule('FREQ=MONTHLY'), at(2026, 1, 1), at(2026, 6, 1));
    assert.deepEqual(occ, [at(2026, 1, 31, 10), at(2026, 3, 31, 10), at(2026, 5, 31, 10)]);
  });

  it('respects COUNT and UNTIL', () => {
    const start = at(2026, 11, 1, 9);
    assert.equal(occurrencesBetween(start, parseRule('FREQ=DAILY;COUNT=3'), 0, at(2027, 1, 1)).length, 3);
    const until = at(2026, 11, 4, 9);
    assert.equal(occurrencesBetween(start, parseRule(`FREQ=DAILY;UNTIL=${until}`), 0, at(2027, 1, 1)).length, 4);
  });

  it('includes occurrences that started before the range but overlap it', () => {
    const start = at(2026, 11, 1, 23);
    const occ = occurrencesBetween(start, null, at(2026, 11, 2), at(2026, 11, 3), 2 * 3600_000);
    assert.deepEqual(occ, [start]);
  });

  it('finds the next occurrence', () => {
    const start = at(2026, 11, 2, 7); // Monday
    const rule = parseRule('FREQ=WEEKLY');
    assert.equal(nextOccurrence(start, rule, at(2026, 11, 2, 7)), at(2026, 11, 9, 7));
    assert.equal(nextOccurrence(start, rule, at(2026, 11, 1)), start);
    assert.equal(nextOccurrence(start, null, at(2026, 11, 3)), null);
  });

  it('describes rules in Slovak', () => {
    assert.equal(describeRule(parseRule('FREQ=DAILY')), 'Každý deň');
    assert.equal(describeRule(parseRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')), 'Každý pracovný deň');
    assert.equal(describeRule(parseRule('FREQ=WEEKLY;BYDAY=FR')), 'Každý piatok');
    assert.equal(describeRule(null), 'Neopakuje sa');
  });
});
